"""
Email Service

Handles transactional email sending with multiple provider support.
Supports SMTP, SendGrid, AWS SES, and Mailgun.

Version: 2.4.0
"""

import asyncio
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
import json
import logging
import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path

from core.config import settings

logger = logging.getLogger(__name__)


class EmailProvider(str, Enum):
    """Supported email providers."""
    SMTP = "smtp"
    SENDGRID = "sendgrid"
    AWS_SES = "aws_ses"
    MAILGUN = "mailgun"


class EmailPriority(str, Enum):
    """Email priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


@dataclass
class EmailAddress:
    """Email address with optional name."""
    email: str
    name: Optional[str] = None
    
    def __str__(self) -> str:
        if self.name:
            return f"{self.name} <{self.email}>"
        return self.email


@dataclass
class EmailAttachment:
    """Email attachment."""
    filename: str
    content: bytes
    content_type: str = "application/octet-stream"


@dataclass
class EmailMessage:
    """Email message structure."""
    to: List[EmailAddress]
    subject: str
    html_body: str
    text_body: Optional[str] = None
    from_address: Optional[EmailAddress] = None
    reply_to: Optional[EmailAddress] = None
    cc: List[EmailAddress] = field(default_factory=list)
    bcc: List[EmailAddress] = field(default_factory=list)
    attachments: List[EmailAttachment] = field(default_factory=list)
    priority: EmailPriority = EmailPriority.NORMAL
    headers: Dict[str, str] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    template_name: Optional[str] = None
    template_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EmailResult:
    """Result of email sending operation."""
    success: bool
    message_id: Optional[str] = None
    provider: Optional[EmailProvider] = None
    error: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)


class EmailTemplateEngine:
    """Jinja2-based email template engine."""
    
    def __init__(self, template_dir: Optional[str] = None):
        if template_dir is None:
            template_dir = Path(__file__).parent.parent / "templates" / "email"
        
        self.template_dir = Path(template_dir)
        self.template_dir.mkdir(parents=True, exist_ok=True)
        
        self.env = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            autoescape=select_autoescape(['html', 'xml']),
            enable_async=True
        )
        
        # Add custom filters
        self.env.filters['currency'] = self._format_currency
        self.env.filters['date'] = self._format_date
        self.env.filters['datetime'] = self._format_datetime
    
    def _format_currency(self, value: float, currency: str = "USD") -> str:
        """Format currency value."""
        symbols = {"USD": "$", "EUR": "€", "GBP": "£"}
        symbol = symbols.get(currency, currency)
        return f"{symbol}{value:,.2f}"
    
    def _format_date(self, value: datetime) -> str:
        """Format date."""
        if isinstance(value, str):
            value = datetime.fromisoformat(value)
        return value.strftime("%B %d, %Y")
    
    def _format_datetime(self, value: datetime) -> str:
        """Format datetime."""
        if isinstance(value, str):
            value = datetime.fromisoformat(value)
        return value.strftime("%B %d, %Y at %I:%M %p")
    
    async def render(
        self,
        template_name: str,
        context: Dict[str, Any]
    ) -> tuple[str, str]:
        """
        Render email template.
        
        Returns tuple of (html_content, text_content).
        """
        # Add default context
        default_context = {
            "app_name": settings.APP_NAME,
            "app_url": settings.APP_URL,
            "support_email": settings.SUPPORT_EMAIL,
            "current_year": datetime.utcnow().year
        }
        context = {**default_context, **context}
        
        # Render HTML template
        html_template = self.env.get_template(f"{template_name}.html")
        html_content = await html_template.render_async(context)
        
        # Try to render text template
        text_content = ""
        try:
            text_template = self.env.get_template(f"{template_name}.txt")
            text_content = await text_template.render_async(context)
        except Exception:
            # Generate text from HTML if no text template
            text_content = self._html_to_text(html_content)
        
        return html_content, text_content
    
    def _html_to_text(self, html: str) -> str:
        """Convert HTML to plain text (simple implementation)."""
        import re
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', html)
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)
        return text.strip()


class SMTPProvider:
    """SMTP email provider."""
    
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        use_tls: bool = True
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_tls = use_tls
    
    async def send(self, message: EmailMessage) -> EmailResult:
        """Send email via SMTP."""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = message.subject
            msg['From'] = str(message.from_address)
            msg['To'] = ', '.join(str(addr) for addr in message.to)
            
            if message.cc:
                msg['Cc'] = ', '.join(str(addr) for addr in message.cc)
            if message.reply_to:
                msg['Reply-To'] = str(message.reply_to)
            
            # Add custom headers
            for key, value in message.headers.items():
                msg[key] = value
            
            # Add body
            if message.text_body:
                msg.attach(MIMEText(message.text_body, 'plain'))
            msg.attach(MIMEText(message.html_body, 'html'))
            
            # Send
            loop = asyncio.get_event_loop()
            message_id = await loop.run_in_executor(
                None,
                self._send_sync,
                msg,
                message.to + message.cc + message.bcc
            )
            
            return EmailResult(
                success=True,
                message_id=message_id,
                provider=EmailProvider.SMTP
            )
        except Exception as e:
            logger.error(f"SMTP send error: {e}")
            return EmailResult(
                success=False,
                provider=EmailProvider.SMTP,
                error=str(e)
            )
    
    def _send_sync(
        self,
        msg: MIMEMultipart,
        recipients: List[EmailAddress]
    ) -> str:
        """Synchronous SMTP send."""
        context = ssl.create_default_context()
        
        if self.use_tls:
            with smtplib.SMTP(self.host, self.port) as server:
                server.starttls(context=context)
                server.login(self.username, self.password)
                server.send_message(msg, to_addrs=[r.email for r in recipients])
                return msg['Message-ID'] or f"smtp-{datetime.utcnow().timestamp()}"
        else:
            with smtplib.SMTP_SSL(self.host, self.port, context=context) as server:
                server.login(self.username, self.password)
                server.send_message(msg, to_addrs=[r.email for r in recipients])
                return msg['Message-ID'] or f"smtp-{datetime.utcnow().timestamp()}"


class SendGridProvider:
    """SendGrid email provider."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.sendgrid.com/v3"
    
    async def send(self, message: EmailMessage) -> EmailResult:
        """Send email via SendGrid."""
        try:
            payload = {
                "personalizations": [{
                    "to": [{"email": addr.email, "name": addr.name} for addr in message.to],
                    "subject": message.subject
                }],
                "from": {
                    "email": message.from_address.email,
                    "name": message.from_address.name
                },
                "content": [
                    {"type": "text/html", "value": message.html_body}
                ]
            }
            
            if message.text_body:
                payload["content"].insert(0, {"type": "text/plain", "value": message.text_body})
            
            if message.cc:
                payload["personalizations"][0]["cc"] = [
                    {"email": addr.email, "name": addr.name} for addr in message.cc
                ]
            
            if message.bcc:
                payload["personalizations"][0]["bcc"] = [
                    {"email": addr.email, "name": addr.name} for addr in message.bcc
                ]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/mail/send",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code in (200, 202):
                    message_id = response.headers.get("X-Message-Id", "")
                    return EmailResult(
                        success=True,
                        message_id=message_id,
                        provider=EmailProvider.SENDGRID
                    )
                else:
                    return EmailResult(
                        success=False,
                        provider=EmailProvider.SENDGRID,
                        error=response.text
                    )
        except Exception as e:
            logger.error(f"SendGrid send error: {e}")
            return EmailResult(
                success=False,
                provider=EmailProvider.SENDGRID,
                error=str(e)
            )


class MailgunProvider:
    """Mailgun email provider."""
    
    def __init__(self, api_key: str, domain: str):
        self.api_key = api_key
        self.domain = domain
        self.base_url = f"https://api.mailgun.net/v3/{domain}"
    
    async def send(self, message: EmailMessage) -> EmailResult:
        """Send email via Mailgun."""
        try:
            data = {
                "from": str(message.from_address),
                "to": [str(addr) for addr in message.to],
                "subject": message.subject,
                "html": message.html_body
            }
            
            if message.text_body:
                data["text"] = message.text_body
            
            if message.cc:
                data["cc"] = [str(addr) for addr in message.cc]
            
            if message.bcc:
                data["bcc"] = [str(addr) for addr in message.bcc]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/messages",
                    data=data,
                    auth=("api", self.api_key)
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return EmailResult(
                        success=True,
                        message_id=result.get("id", ""),
                        provider=EmailProvider.MAILGUN
                    )
                else:
                    return EmailResult(
                        success=False,
                        provider=EmailProvider.MAILGUN,
                        error=response.text
                    )
        except Exception as e:
            logger.error(f"Mailgun send error: {e}")
            return EmailResult(
                success=False,
                provider=EmailProvider.MAILGUN,
                error=str(e)
            )


class EmailService:
    """
    Main email service with template support and multiple providers.
    """
    
    def __init__(self):
        self.template_engine = EmailTemplateEngine()
        self.providers: Dict[EmailProvider, Any] = {}
        self.default_provider: Optional[EmailProvider] = None
        self.default_from = EmailAddress(
            email=getattr(settings, 'EMAIL_FROM', 'noreply@ue5-ai-studio.com'),
            name=getattr(settings, 'EMAIL_FROM_NAME', 'UE5 AI Studio')
        )
        
        self._setup_providers()
    
    def _setup_providers(self):
        """Set up email providers from settings."""
        # SMTP
        if hasattr(settings, 'SMTP_HOST') and settings.SMTP_HOST:
            self.providers[EmailProvider.SMTP] = SMTPProvider(
                host=settings.SMTP_HOST,
                port=getattr(settings, 'SMTP_PORT', 587),
                username=getattr(settings, 'SMTP_USERNAME', ''),
                password=getattr(settings, 'SMTP_PASSWORD', ''),
                use_tls=getattr(settings, 'SMTP_TLS', True)
            )
            self.default_provider = EmailProvider.SMTP
        
        # SendGrid
        if hasattr(settings, 'SENDGRID_API_KEY') and settings.SENDGRID_API_KEY:
            self.providers[EmailProvider.SENDGRID] = SendGridProvider(
                api_key=settings.SENDGRID_API_KEY
            )
            if not self.default_provider:
                self.default_provider = EmailProvider.SENDGRID
        
        # Mailgun
        if hasattr(settings, 'MAILGUN_API_KEY') and settings.MAILGUN_API_KEY:
            self.providers[EmailProvider.MAILGUN] = MailgunProvider(
                api_key=settings.MAILGUN_API_KEY,
                domain=getattr(settings, 'MAILGUN_DOMAIN', '')
            )
            if not self.default_provider:
                self.default_provider = EmailProvider.MAILGUN
    
    async def send(
        self,
        message: EmailMessage,
        provider: Optional[EmailProvider] = None
    ) -> EmailResult:
        """Send an email message."""
        # Set default from address
        if not message.from_address:
            message.from_address = self.default_from
        
        # Render template if specified
        if message.template_name:
            html_body, text_body = await self.template_engine.render(
                message.template_name,
                message.template_data
            )
            message.html_body = html_body
            message.text_body = text_body
        
        # Select provider
        selected_provider = provider or self.default_provider
        if not selected_provider or selected_provider not in self.providers:
            return EmailResult(
                success=False,
                error="No email provider configured"
            )
        
        # Send
        return await self.providers[selected_provider].send(message)
    
    async def send_template(
        self,
        to: Union[str, List[str], EmailAddress, List[EmailAddress]],
        template_name: str,
        template_data: Dict[str, Any],
        subject: Optional[str] = None
    ) -> EmailResult:
        """Send a templated email."""
        # Normalize recipients
        if isinstance(to, str):
            recipients = [EmailAddress(email=to)]
        elif isinstance(to, EmailAddress):
            recipients = [to]
        elif isinstance(to, list):
            recipients = [
                addr if isinstance(addr, EmailAddress) else EmailAddress(email=addr)
                for addr in to
            ]
        else:
            recipients = [EmailAddress(email=to)]
        
        # Get subject from template data or use default
        if not subject:
            subject = template_data.get('subject', f"Message from {settings.APP_NAME}")
        
        message = EmailMessage(
            to=recipients,
            subject=subject,
            html_body="",  # Will be rendered from template
            template_name=template_name,
            template_data=template_data
        )
        
        return await self.send(message)
    
    # =========================================================================
    # CONVENIENCE METHODS FOR COMMON EMAILS
    # =========================================================================
    
    async def send_welcome(
        self,
        to: str,
        username: str,
        verification_link: Optional[str] = None
    ) -> EmailResult:
        """Send welcome email to new user."""
        return await self.send_template(
            to=to,
            template_name="welcome",
            template_data={
                "subject": f"Welcome to {settings.APP_NAME}!",
                "username": username,
                "verification_link": verification_link
            }
        )
    
    async def send_password_reset(
        self,
        to: str,
        username: str,
        reset_link: str,
        expires_in: str = "1 hour"
    ) -> EmailResult:
        """Send password reset email."""
        return await self.send_template(
            to=to,
            template_name="password_reset",
            template_data={
                "subject": "Reset Your Password",
                "username": username,
                "reset_link": reset_link,
                "expires_in": expires_in
            }
        )
    
    async def send_team_invite(
        self,
        to: str,
        inviter_name: str,
        team_name: str,
        invite_link: str,
        role: str = "Member"
    ) -> EmailResult:
        """Send team invitation email."""
        return await self.send_template(
            to=to,
            template_name="team_invite",
            template_data={
                "subject": f"You've been invited to join {team_name}",
                "inviter_name": inviter_name,
                "team_name": team_name,
                "invite_link": invite_link,
                "role": role
            }
        )
    
    async def send_invoice(
        self,
        to: str,
        username: str,
        invoice_number: str,
        amount: float,
        currency: str = "USD",
        items: List[Dict[str, Any]] = None,
        invoice_link: Optional[str] = None
    ) -> EmailResult:
        """Send invoice email."""
        return await self.send_template(
            to=to,
            template_name="invoice",
            template_data={
                "subject": f"Invoice #{invoice_number}",
                "username": username,
                "invoice_number": invoice_number,
                "amount": amount,
                "currency": currency,
                "items": items or [],
                "invoice_link": invoice_link
            }
        )
    
    async def send_subscription_confirmation(
        self,
        to: str,
        username: str,
        plan_name: str,
        amount: float,
        billing_period: str = "monthly",
        next_billing_date: Optional[datetime] = None
    ) -> EmailResult:
        """Send subscription confirmation email."""
        return await self.send_template(
            to=to,
            template_name="subscription_confirmation",
            template_data={
                "subject": f"Subscription Confirmed: {plan_name}",
                "username": username,
                "plan_name": plan_name,
                "amount": amount,
                "billing_period": billing_period,
                "next_billing_date": next_billing_date
            }
        )
    
    async def send_subscription_cancelled(
        self,
        to: str,
        username: str,
        plan_name: str,
        end_date: datetime
    ) -> EmailResult:
        """Send subscription cancellation email."""
        return await self.send_template(
            to=to,
            template_name="subscription_cancelled",
            template_data={
                "subject": "Subscription Cancelled",
                "username": username,
                "plan_name": plan_name,
                "end_date": end_date
            }
        )
    
    async def send_payment_failed(
        self,
        to: str,
        username: str,
        amount: float,
        retry_link: str,
        reason: Optional[str] = None
    ) -> EmailResult:
        """Send payment failed notification."""
        return await self.send_template(
            to=to,
            template_name="payment_failed",
            template_data={
                "subject": "Payment Failed - Action Required",
                "username": username,
                "amount": amount,
                "retry_link": retry_link,
                "reason": reason
            }
        )


# Singleton instance
email_service = EmailService()


def get_email_service() -> EmailService:
    """Get email service instance."""
    return email_service
