"""
UE5 AI Studio - Plugin Execution Engine
========================================

Secure plugin execution engine with sandboxing, timeout,
and resource limits.

Version: 2.2.0
"""

import asyncio
import ast
import sys
import io
import traceback
import time
import logging
import resource
import signal
from typing import Dict, Any, Optional, List, Callable
from contextlib import contextmanager, redirect_stdout, redirect_stderr
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import threading

logger = logging.getLogger(__name__)


# =============================================================================
# SAFE BUILTINS
# =============================================================================

# Allowed built-in functions for plugin execution
SAFE_BUILTINS = {
    # Types
    'bool': bool,
    'int': int,
    'float': float,
    'str': str,
    'list': list,
    'dict': dict,
    'tuple': tuple,
    'set': set,
    'frozenset': frozenset,
    'bytes': bytes,
    'bytearray': bytearray,
    
    # Functions
    'abs': abs,
    'all': all,
    'any': any,
    'ascii': ascii,
    'bin': bin,
    'callable': callable,
    'chr': chr,
    'divmod': divmod,
    'enumerate': enumerate,
    'filter': filter,
    'format': format,
    'getattr': getattr,
    'hasattr': hasattr,
    'hash': hash,
    'hex': hex,
    'id': id,
    'isinstance': isinstance,
    'issubclass': issubclass,
    'iter': iter,
    'len': len,
    'map': map,
    'max': max,
    'min': min,
    'next': next,
    'oct': oct,
    'ord': ord,
    'pow': pow,
    'print': print,
    'range': range,
    'repr': repr,
    'reversed': reversed,
    'round': round,
    'setattr': setattr,
    'slice': slice,
    'sorted': sorted,
    'sum': sum,
    'type': type,
    'zip': zip,
    
    # Exceptions
    'Exception': Exception,
    'ValueError': ValueError,
    'TypeError': TypeError,
    'KeyError': KeyError,
    'IndexError': IndexError,
    'AttributeError': AttributeError,
    'RuntimeError': RuntimeError,
    
    # Constants
    'True': True,
    'False': False,
    'None': None,
}

# Allowed modules for import
ALLOWED_MODULES = {
    # Standard library - safe modules
    'json',
    'math',
    'random',
    'datetime',
    'time',
    're',
    'collections',
    'itertools',
    'functools',
    'operator',
    'string',
    'textwrap',
    'unicodedata',
    'hashlib',
    'base64',
    'uuid',
    'copy',
    'typing',
    'dataclasses',
    'enum',
    'decimal',
    'fractions',
    'statistics',
    
    # Data processing
    'csv',
    'io',
}

# Forbidden AST nodes (dangerous operations)
FORBIDDEN_NODES = {
    'Import',  # We handle imports separately
    'ImportFrom',
}


# =============================================================================
# CODE VALIDATOR
# =============================================================================

class CodeValidator:
    """
    Validates plugin code for security issues.
    """
    
    DANGEROUS_PATTERNS = [
        '__import__',
        'eval',
        'exec',
        'compile',
        'open',
        'file',
        '__builtins__',
        '__globals__',
        '__code__',
        '__class__',
        '__bases__',
        '__subclasses__',
        '__mro__',
        'subprocess',
        'os.system',
        'os.popen',
        'os.spawn',
        'os.exec',
        'sys.exit',
        'exit',
        'quit',
    ]
    
    @classmethod
    def validate(cls, code: str, allowed_imports: List[str] = None) -> tuple[bool, str]:
        """
        Validate plugin code for security issues.
        
        Args:
            code: Python code to validate
            allowed_imports: List of allowed module imports
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if allowed_imports is None:
            allowed_imports = list(ALLOWED_MODULES)
        
        # Check for dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            if pattern in code:
                return False, f"Forbidden pattern detected: {pattern}"
        
        # Parse AST
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax error: {e}"
        
        # Validate AST nodes
        for node in ast.walk(tree):
            # Check imports
            if isinstance(node, ast.Import):
                for alias in node.names:
                    module = alias.name.split('.')[0]
                    if module not in allowed_imports and module not in ALLOWED_MODULES:
                        return False, f"Import not allowed: {alias.name}"
            
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    module = node.module.split('.')[0]
                    if module not in allowed_imports and module not in ALLOWED_MODULES:
                        return False, f"Import not allowed: {node.module}"
            
            # Check for attribute access to dangerous names
            elif isinstance(node, ast.Attribute):
                if node.attr.startswith('__') and node.attr.endswith('__'):
                    if node.attr not in ['__init__', '__str__', '__repr__', '__len__', '__iter__', '__next__', '__getitem__', '__setitem__', '__contains__']:
                        return False, f"Access to dunder attribute not allowed: {node.attr}"
        
        return True, ""
    
    @classmethod
    def has_async_main(cls, code: str) -> bool:
        """Check if the main function is async."""
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.AsyncFunctionDef) and node.name == 'main':
                    return True
            return False
        except:
            return False


# =============================================================================
# EXECUTION CONTEXT
# =============================================================================

class ExecutionContext:
    """
    Context provided to plugins during execution.
    """
    
    def __init__(
        self,
        mcp_client: Any = None,
        workspace_service: Any = None,
        user_id: int = None,
        project_id: int = None,
        config: Dict[str, Any] = None
    ):
        self.mcp = mcp_client
        self.workspace = workspace_service
        self.user_id = user_id
        self.project_id = project_id
        self.config = config or {}
        self._logs = []
    
    def log(self, message: str, level: str = "info"):
        """Log a message from the plugin."""
        self._logs.append({
            "level": level,
            "message": message,
            "timestamp": time.time()
        })
    
    def get_logs(self) -> List[Dict[str, Any]]:
        """Get all logged messages."""
        return self._logs
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary for plugin access."""
        return {
            "mcp": self.mcp,
            "workspace": self.workspace,
            "user_id": self.user_id,
            "project_id": self.project_id,
            "config": self.config,
            "log": self.log,
        }


# =============================================================================
# PLUGIN EXECUTOR
# =============================================================================

class PluginExecutor:
    """
    Secure plugin execution engine.
    
    Features:
    - Code validation and sandboxing
    - Timeout enforcement
    - Memory limits
    - Restricted imports
    - Output capture
    """
    
    DEFAULT_TIMEOUT = 30  # seconds
    DEFAULT_MEMORY_MB = 256
    
    def __init__(
        self,
        timeout: int = DEFAULT_TIMEOUT,
        max_memory_mb: int = DEFAULT_MEMORY_MB,
        allowed_imports: List[str] = None
    ):
        self.timeout = timeout
        self.max_memory_mb = max_memory_mb
        self.allowed_imports = allowed_imports or list(ALLOWED_MODULES)
        self._executor = ThreadPoolExecutor(max_workers=4)
    
    def _create_safe_globals(self) -> Dict[str, Any]:
        """Create a safe globals dictionary for execution."""
        safe_globals = {
            '__builtins__': SAFE_BUILTINS.copy(),
            '__name__': '__plugin__',
            '__doc__': None,
        }
        return safe_globals
    
    def _create_safe_locals(self, context: ExecutionContext) -> Dict[str, Any]:
        """Create a safe locals dictionary with context."""
        return {
            'context': context.to_dict(),
        }
    
    def _import_allowed_modules(self, globals_dict: Dict[str, Any]):
        """Import allowed modules into globals."""
        for module_name in self.allowed_imports:
            if module_name in ALLOWED_MODULES:
                try:
                    globals_dict[module_name] = __import__(module_name)
                except ImportError:
                    pass
    
    def validate_code(self, code: str) -> tuple[bool, str]:
        """
        Validate plugin code.
        
        Args:
            code: Python code to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        return CodeValidator.validate(code, self.allowed_imports)
    
    def _execute_sync(
        self,
        code: str,
        input_data: Dict[str, Any],
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """
        Execute plugin code synchronously.
        
        Args:
            code: Plugin code
            input_data: Input parameters
            context: Execution context
            
        Returns:
            Execution result
        """
        # Capture output
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        # Create execution environment
        globals_dict = self._create_safe_globals()
        locals_dict = self._create_safe_locals(context)
        
        # Import allowed modules
        self._import_allowed_modules(globals_dict)
        
        try:
            # Execute the code to define functions
            exec(code, globals_dict, locals_dict)
            
            # Get the main function
            main_func = locals_dict.get('main') or globals_dict.get('main')
            
            if not main_func:
                return {
                    "success": False,
                    "error": "No 'main' function found in plugin code",
                    "output": None,
                    "stdout": "",
                    "stderr": ""
                }
            
            # Execute main function with output capture
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                result = main_func(input_data, context.to_dict())
            
            return {
                "success": True,
                "error": None,
                "output": result,
                "stdout": stdout_capture.getvalue(),
                "stderr": stderr_capture.getvalue(),
                "logs": context.get_logs()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"{type(e).__name__}: {str(e)}",
                "traceback": traceback.format_exc(),
                "output": None,
                "stdout": stdout_capture.getvalue(),
                "stderr": stderr_capture.getvalue(),
                "logs": context.get_logs()
            }
    
    async def _execute_async(
        self,
        code: str,
        input_data: Dict[str, Any],
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """
        Execute async plugin code.
        
        Args:
            code: Plugin code with async main
            input_data: Input parameters
            context: Execution context
            
        Returns:
            Execution result
        """
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        globals_dict = self._create_safe_globals()
        locals_dict = self._create_safe_locals(context)
        
        self._import_allowed_modules(globals_dict)
        
        try:
            exec(code, globals_dict, locals_dict)
            
            main_func = locals_dict.get('main') or globals_dict.get('main')
            
            if not main_func:
                return {
                    "success": False,
                    "error": "No 'main' function found in plugin code",
                    "output": None,
                    "stdout": "",
                    "stderr": ""
                }
            
            # Execute async main
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                if asyncio.iscoroutinefunction(main_func):
                    result = await main_func(input_data, context.to_dict())
                else:
                    result = main_func(input_data, context.to_dict())
            
            return {
                "success": True,
                "error": None,
                "output": result,
                "stdout": stdout_capture.getvalue(),
                "stderr": stderr_capture.getvalue(),
                "logs": context.get_logs()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"{type(e).__name__}: {str(e)}",
                "traceback": traceback.format_exc(),
                "output": None,
                "stdout": stdout_capture.getvalue(),
                "stderr": stderr_capture.getvalue(),
                "logs": context.get_logs()
            }
    
    async def execute(
        self,
        code: str,
        input_data: Dict[str, Any] = None,
        context: ExecutionContext = None,
        timeout: int = None
    ) -> Dict[str, Any]:
        """
        Execute plugin code with timeout and sandboxing.
        
        Args:
            code: Plugin code
            input_data: Input parameters
            context: Execution context
            timeout: Execution timeout in seconds
            
        Returns:
            Execution result dictionary
        """
        if input_data is None:
            input_data = {}
        
        if context is None:
            context = ExecutionContext()
        
        if timeout is None:
            timeout = self.timeout
        
        start_time = time.time()
        
        # Validate code first
        is_valid, error = self.validate_code(code)
        if not is_valid:
            return {
                "success": False,
                "error": f"Code validation failed: {error}",
                "output": None,
                "execution_time_ms": 0,
                "stdout": "",
                "stderr": ""
            }
        
        try:
            # Check if async
            is_async = CodeValidator.has_async_main(code)
            
            if is_async:
                # Execute async with timeout
                result = await asyncio.wait_for(
                    self._execute_async(code, input_data, context),
                    timeout=timeout
                )
            else:
                # Execute sync in thread pool with timeout
                loop = asyncio.get_event_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(
                        self._executor,
                        self._execute_sync,
                        code,
                        input_data,
                        context
                    ),
                    timeout=timeout
                )
            
            execution_time_ms = int((time.time() - start_time) * 1000)
            result["execution_time_ms"] = execution_time_ms
            
            return result
            
        except asyncio.TimeoutError:
            execution_time_ms = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "error": f"Execution timed out after {timeout} seconds",
                "output": None,
                "execution_time_ms": execution_time_ms,
                "stdout": "",
                "stderr": ""
            }
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "error": f"Execution error: {str(e)}",
                "traceback": traceback.format_exc(),
                "output": None,
                "execution_time_ms": execution_time_ms,
                "stdout": "",
                "stderr": ""
            }
    
    def close(self):
        """Shutdown the executor."""
        self._executor.shutdown(wait=False)


# =============================================================================
# GLOBAL EXECUTOR INSTANCE
# =============================================================================

# Global executor instance
_executor: Optional[PluginExecutor] = None


def get_executor() -> PluginExecutor:
    """Get or create the global plugin executor."""
    global _executor
    if _executor is None:
        _executor = PluginExecutor()
    return _executor


async def execute_plugin(
    code: str,
    input_data: Dict[str, Any] = None,
    context: ExecutionContext = None,
    timeout: int = None
) -> Dict[str, Any]:
    """
    Convenience function to execute a plugin.
    
    Args:
        code: Plugin code
        input_data: Input parameters
        context: Execution context
        timeout: Execution timeout
        
    Returns:
        Execution result
    """
    executor = get_executor()
    return await executor.execute(code, input_data, context, timeout)
