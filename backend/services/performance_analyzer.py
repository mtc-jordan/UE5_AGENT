"""
Performance Analyzer Service

AI-powered performance analysis and optimization for UE5 projects:
- Real-time metrics collection
- Bottleneck detection
- Optimization recommendations
- Auto-optimization actions
"""

import asyncio
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import json
import os
from openai import AsyncOpenAI


class BottleneckType(str, Enum):
    CPU = "cpu"
    GPU = "gpu"
    MEMORY = "memory"
    DRAW_CALLS = "draw_calls"
    TRIANGLES = "triangles"
    LIGHTS = "lights"
    SHADOWS = "shadows"
    TEXTURES = "textures"
    MATERIALS = "materials"
    PHYSICS = "physics"
    STREAMING = "streaming"


class OptimizationPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class PerformanceMetrics:
    """Real-time performance metrics from UE5"""
    fps: float = 0.0
    frame_time_ms: float = 0.0
    game_thread_ms: float = 0.0
    render_thread_ms: float = 0.0
    gpu_time_ms: float = 0.0
    
    # Memory
    used_memory_mb: float = 0.0
    texture_memory_mb: float = 0.0
    mesh_memory_mb: float = 0.0
    
    # Rendering
    draw_calls: int = 0
    triangles_drawn: int = 0
    visible_static_meshes: int = 0
    visible_skeletal_meshes: int = 0
    
    # Lights & Shadows
    dynamic_lights: int = 0
    shadow_casting_lights: int = 0
    shadow_maps: int = 0
    
    # Materials
    material_count: int = 0
    shader_complexity_avg: float = 0.0
    
    # Physics
    physics_bodies: int = 0
    collision_queries: int = 0
    
    timestamp: str = ""


@dataclass
class Bottleneck:
    """Detected performance bottleneck"""
    id: str
    type: BottleneckType
    severity: OptimizationPriority
    title: str
    description: str
    current_value: float
    recommended_value: float
    impact_estimate: str  # e.g., "+15 FPS"
    affected_actors: List[str] = field(default_factory=list)
    auto_fix_available: bool = False
    auto_fix_action: Optional[str] = None


@dataclass
class OptimizationRecommendation:
    """AI-generated optimization recommendation"""
    id: str
    title: str
    description: str
    category: str
    priority: OptimizationPriority
    estimated_improvement: str
    steps: List[str]
    auto_apply_available: bool = False
    auto_apply_action: Optional[str] = None


@dataclass
class PerformanceReport:
    """Complete performance analysis report"""
    id: str
    timestamp: str
    metrics: PerformanceMetrics
    overall_score: int  # 0-100
    performance_grade: str  # A, B, C, D, F
    target_platform: str
    bottlenecks: List[Bottleneck]
    recommendations: List[OptimizationRecommendation]
    ai_summary: str
    comparison_with_previous: Optional[Dict[str, Any]] = None


class PerformanceAnalyzerService:
    """Service for analyzing and optimizing UE5 performance"""
    
    # Performance thresholds by platform
    PLATFORM_TARGETS = {
        "pc_ultra": {
            "target_fps": 60,
            "max_draw_calls": 5000,
            "max_triangles": 10_000_000,
            "max_dynamic_lights": 20,
            "max_shadow_casting": 10,
            "max_texture_memory_mb": 4096,
            "max_frame_time_ms": 16.67
        },
        "pc_high": {
            "target_fps": 60,
            "max_draw_calls": 3000,
            "max_triangles": 5_000_000,
            "max_dynamic_lights": 10,
            "max_shadow_casting": 5,
            "max_texture_memory_mb": 2048,
            "max_frame_time_ms": 16.67
        },
        "pc_medium": {
            "target_fps": 60,
            "max_draw_calls": 2000,
            "max_triangles": 2_000_000,
            "max_dynamic_lights": 5,
            "max_shadow_casting": 3,
            "max_texture_memory_mb": 1024,
            "max_frame_time_ms": 16.67
        },
        "console": {
            "target_fps": 60,
            "max_draw_calls": 2500,
            "max_triangles": 3_000_000,
            "max_dynamic_lights": 8,
            "max_shadow_casting": 4,
            "max_texture_memory_mb": 2048,
            "max_frame_time_ms": 16.67
        },
        "mobile": {
            "target_fps": 30,
            "max_draw_calls": 500,
            "max_triangles": 500_000,
            "max_dynamic_lights": 2,
            "max_shadow_casting": 1,
            "max_texture_memory_mb": 512,
            "max_frame_time_ms": 33.33
        }
    }
    
    def __init__(self):
        self.client = AsyncOpenAI()
        self.reports: Dict[str, PerformanceReport] = {}
        self.metrics_history: List[PerformanceMetrics] = []
        self.max_history = 100
    
    async def analyze_performance(
        self,
        metrics: Dict[str, Any],
        scene_data: Optional[Dict[str, Any]] = None,
        target_platform: str = "pc_high",
        model: str = "deepseek-chat"
    ) -> PerformanceReport:
        """
        Perform comprehensive performance analysis
        """
        # Parse metrics
        perf_metrics = self._parse_metrics(metrics)
        
        # Store in history
        self.metrics_history.append(perf_metrics)
        if len(self.metrics_history) > self.max_history:
            self.metrics_history.pop(0)
        
        # Get platform targets
        targets = self.PLATFORM_TARGETS.get(target_platform, self.PLATFORM_TARGETS["pc_high"])
        
        # Detect bottlenecks
        bottlenecks = self._detect_bottlenecks(perf_metrics, targets, scene_data)
        
        # Calculate overall score
        overall_score = self._calculate_score(perf_metrics, targets, bottlenecks)
        
        # Get performance grade
        grade = self._get_grade(overall_score)
        
        # Generate AI recommendations
        recommendations = await self._generate_ai_recommendations(
            perf_metrics, bottlenecks, scene_data, target_platform, model
        )
        
        # Generate AI summary
        ai_summary = await self._generate_ai_summary(
            perf_metrics, bottlenecks, recommendations, target_platform, model
        )
        
        # Compare with previous report
        comparison = None
        if self.reports:
            last_report = list(self.reports.values())[-1]
            comparison = self._compare_with_previous(perf_metrics, last_report.metrics)
        
        # Create report
        report = PerformanceReport(
            id=str(uuid.uuid4()),
            timestamp=datetime.now().isoformat(),
            metrics=perf_metrics,
            overall_score=overall_score,
            performance_grade=grade,
            target_platform=target_platform,
            bottlenecks=bottlenecks,
            recommendations=recommendations,
            ai_summary=ai_summary,
            comparison_with_previous=comparison
        )
        
        # Store report
        self.reports[report.id] = report
        
        return report
    
    def _parse_metrics(self, raw_metrics: Dict[str, Any]) -> PerformanceMetrics:
        """Parse raw metrics from UE5 into structured format"""
        return PerformanceMetrics(
            fps=raw_metrics.get("fps", 0.0),
            frame_time_ms=raw_metrics.get("frame_time_ms", 0.0),
            game_thread_ms=raw_metrics.get("game_thread_ms", 0.0),
            render_thread_ms=raw_metrics.get("render_thread_ms", 0.0),
            gpu_time_ms=raw_metrics.get("gpu_time_ms", 0.0),
            used_memory_mb=raw_metrics.get("used_memory_mb", 0.0),
            texture_memory_mb=raw_metrics.get("texture_memory_mb", 0.0),
            mesh_memory_mb=raw_metrics.get("mesh_memory_mb", 0.0),
            draw_calls=raw_metrics.get("draw_calls", 0),
            triangles_drawn=raw_metrics.get("triangles_drawn", 0),
            visible_static_meshes=raw_metrics.get("visible_static_meshes", 0),
            visible_skeletal_meshes=raw_metrics.get("visible_skeletal_meshes", 0),
            dynamic_lights=raw_metrics.get("dynamic_lights", 0),
            shadow_casting_lights=raw_metrics.get("shadow_casting_lights", 0),
            shadow_maps=raw_metrics.get("shadow_maps", 0),
            material_count=raw_metrics.get("material_count", 0),
            shader_complexity_avg=raw_metrics.get("shader_complexity_avg", 0.0),
            physics_bodies=raw_metrics.get("physics_bodies", 0),
            collision_queries=raw_metrics.get("collision_queries", 0),
            timestamp=datetime.now().isoformat()
        )
    
    def _detect_bottlenecks(
        self,
        metrics: PerformanceMetrics,
        targets: Dict[str, Any],
        scene_data: Optional[Dict[str, Any]]
    ) -> List[Bottleneck]:
        """Detect performance bottlenecks based on metrics and targets"""
        bottlenecks = []
        
        # FPS bottleneck
        if metrics.fps > 0 and metrics.fps < targets["target_fps"]:
            severity = OptimizationPriority.CRITICAL if metrics.fps < targets["target_fps"] * 0.5 else \
                       OptimizationPriority.HIGH if metrics.fps < targets["target_fps"] * 0.75 else \
                       OptimizationPriority.MEDIUM
            
            bottlenecks.append(Bottleneck(
                id=str(uuid.uuid4()),
                type=BottleneckType.GPU if metrics.gpu_time_ms > metrics.game_thread_ms else BottleneckType.CPU,
                severity=severity,
                title="Low Frame Rate",
                description=f"Current FPS ({metrics.fps:.1f}) is below target ({targets['target_fps']})",
                current_value=metrics.fps,
                recommended_value=targets["target_fps"],
                impact_estimate=f"+{targets['target_fps'] - metrics.fps:.0f} FPS potential"
            ))
        
        # Draw calls bottleneck
        if metrics.draw_calls > targets["max_draw_calls"]:
            excess = metrics.draw_calls - targets["max_draw_calls"]
            severity = OptimizationPriority.HIGH if excess > targets["max_draw_calls"] * 0.5 else OptimizationPriority.MEDIUM
            
            bottlenecks.append(Bottleneck(
                id=str(uuid.uuid4()),
                type=BottleneckType.DRAW_CALLS,
                severity=severity,
                title="Excessive Draw Calls",
                description=f"Draw calls ({metrics.draw_calls:,}) exceed recommended limit ({targets['max_draw_calls']:,})",
                current_value=metrics.draw_calls,
                recommended_value=targets["max_draw_calls"],
                impact_estimate="+5-15 FPS",
                auto_fix_available=True,
                auto_fix_action="Enable mesh instancing and merge static meshes"
            ))
        
        # Triangle count bottleneck
        if metrics.triangles_drawn > targets["max_triangles"]:
            excess = metrics.triangles_drawn - targets["max_triangles"]
            severity = OptimizationPriority.HIGH if excess > targets["max_triangles"] * 0.5 else OptimizationPriority.MEDIUM
            
            bottlenecks.append(Bottleneck(
                id=str(uuid.uuid4()),
                type=BottleneckType.TRIANGLES,
                severity=severity,
                title="High Triangle Count",
                description=f"Triangles drawn ({metrics.triangles_drawn:,}) exceed limit ({targets['max_triangles']:,})",
                current_value=metrics.triangles_drawn,
                recommended_value=targets["max_triangles"],
                impact_estimate="+3-10 FPS",
                auto_fix_available=True,
                auto_fix_action="Generate LODs for high-poly meshes"
            ))
        
        # Dynamic lights bottleneck
        if metrics.dynamic_lights > targets["max_dynamic_lights"]:
            bottlenecks.append(Bottleneck(
                id=str(uuid.uuid4()),
                type=BottleneckType.LIGHTS,
                severity=OptimizationPriority.HIGH,
                title="Too Many Dynamic Lights",
                description=f"Dynamic lights ({metrics.dynamic_lights}) exceed limit ({targets['max_dynamic_lights']})",
                current_value=metrics.dynamic_lights,
                recommended_value=targets["max_dynamic_lights"],
                impact_estimate="+5-20 FPS",
                auto_fix_available=True,
                auto_fix_action="Convert some dynamic lights to static/stationary"
            ))
        
        # Shadow casting lights bottleneck
        if metrics.shadow_casting_lights > targets["max_shadow_casting"]:
            bottlenecks.append(Bottleneck(
                id=str(uuid.uuid4()),
                type=BottleneckType.SHADOWS,
                severity=OptimizationPriority.HIGH,
                title="Excessive Shadow-Casting Lights",
                description=f"Shadow-casting lights ({metrics.shadow_casting_lights}) exceed limit ({targets['max_shadow_casting']})",
                current_value=metrics.shadow_casting_lights,
                recommended_value=targets["max_shadow_casting"],
                impact_estimate="+10-25 FPS",
                auto_fix_available=True,
                auto_fix_action="Disable shadows on less important lights"
            ))
        
        # Texture memory bottleneck
        if metrics.texture_memory_mb > targets["max_texture_memory_mb"]:
            bottlenecks.append(Bottleneck(
                id=str(uuid.uuid4()),
                type=BottleneckType.TEXTURES,
                severity=OptimizationPriority.MEDIUM,
                title="High Texture Memory Usage",
                description=f"Texture memory ({metrics.texture_memory_mb:.0f}MB) exceeds limit ({targets['max_texture_memory_mb']}MB)",
                current_value=metrics.texture_memory_mb,
                recommended_value=targets["max_texture_memory_mb"],
                impact_estimate="Reduced stuttering",
                auto_fix_available=True,
                auto_fix_action="Enable texture streaming and reduce texture sizes"
            ))
        
        # GPU bound detection
        if metrics.gpu_time_ms > metrics.game_thread_ms * 1.5 and metrics.gpu_time_ms > 10:
            bottlenecks.append(Bottleneck(
                id=str(uuid.uuid4()),
                type=BottleneckType.GPU,
                severity=OptimizationPriority.HIGH,
                title="GPU Bound",
                description=f"GPU time ({metrics.gpu_time_ms:.1f}ms) significantly higher than game thread ({metrics.game_thread_ms:.1f}ms)",
                current_value=metrics.gpu_time_ms,
                recommended_value=metrics.game_thread_ms,
                impact_estimate="Better frame pacing"
            ))
        
        # CPU bound detection
        if metrics.game_thread_ms > metrics.gpu_time_ms * 1.5 and metrics.game_thread_ms > 10:
            bottlenecks.append(Bottleneck(
                id=str(uuid.uuid4()),
                type=BottleneckType.CPU,
                severity=OptimizationPriority.HIGH,
                title="CPU Bound",
                description=f"Game thread ({metrics.game_thread_ms:.1f}ms) significantly higher than GPU ({metrics.gpu_time_ms:.1f}ms)",
                current_value=metrics.game_thread_ms,
                recommended_value=metrics.gpu_time_ms,
                impact_estimate="Better frame pacing"
            ))
        
        # Sort by severity
        severity_order = {
            OptimizationPriority.CRITICAL: 0,
            OptimizationPriority.HIGH: 1,
            OptimizationPriority.MEDIUM: 2,
            OptimizationPriority.LOW: 3
        }
        bottlenecks.sort(key=lambda b: severity_order[b.severity])
        
        return bottlenecks
    
    def _calculate_score(
        self,
        metrics: PerformanceMetrics,
        targets: Dict[str, Any],
        bottlenecks: List[Bottleneck]
    ) -> int:
        """Calculate overall performance score (0-100)"""
        score = 100
        
        # FPS impact (up to -40 points)
        if metrics.fps > 0:
            fps_ratio = min(metrics.fps / targets["target_fps"], 1.0)
            score -= int((1 - fps_ratio) * 40)
        
        # Draw calls impact (up to -15 points)
        if metrics.draw_calls > 0:
            dc_ratio = min(metrics.draw_calls / targets["max_draw_calls"], 2.0)
            if dc_ratio > 1:
                score -= int((dc_ratio - 1) * 15)
        
        # Triangle count impact (up to -15 points)
        if metrics.triangles_drawn > 0:
            tri_ratio = min(metrics.triangles_drawn / targets["max_triangles"], 2.0)
            if tri_ratio > 1:
                score -= int((tri_ratio - 1) * 15)
        
        # Lights impact (up to -10 points)
        if metrics.dynamic_lights > targets["max_dynamic_lights"]:
            score -= min(10, (metrics.dynamic_lights - targets["max_dynamic_lights"]) * 2)
        
        # Shadows impact (up to -10 points)
        if metrics.shadow_casting_lights > targets["max_shadow_casting"]:
            score -= min(10, (metrics.shadow_casting_lights - targets["max_shadow_casting"]) * 3)
        
        # Memory impact (up to -10 points)
        if metrics.texture_memory_mb > targets["max_texture_memory_mb"]:
            mem_excess = (metrics.texture_memory_mb - targets["max_texture_memory_mb"]) / targets["max_texture_memory_mb"]
            score -= int(min(10, mem_excess * 10))
        
        return max(0, min(100, score))
    
    def _get_grade(self, score: int) -> str:
        """Convert score to letter grade"""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"
    
    async def _generate_ai_recommendations(
        self,
        metrics: PerformanceMetrics,
        bottlenecks: List[Bottleneck],
        scene_data: Optional[Dict[str, Any]],
        target_platform: str,
        model: str
    ) -> List[OptimizationRecommendation]:
        """Generate AI-powered optimization recommendations"""
        
        # Build context for AI
        bottleneck_summary = "\n".join([
            f"- {b.title}: {b.description} (Severity: {b.severity.value})"
            for b in bottlenecks
        ])
        
        metrics_summary = f"""
Current Performance Metrics:
- FPS: {metrics.fps:.1f}
- Frame Time: {metrics.frame_time_ms:.2f}ms
- Draw Calls: {metrics.draw_calls:,}
- Triangles: {metrics.triangles_drawn:,}
- Dynamic Lights: {metrics.dynamic_lights}
- Shadow-Casting Lights: {metrics.shadow_casting_lights}
- Texture Memory: {metrics.texture_memory_mb:.0f}MB
- GPU Time: {metrics.gpu_time_ms:.2f}ms
- Game Thread: {metrics.game_thread_ms:.2f}ms
"""
        
        prompt = f"""You are a UE5 performance optimization expert. Analyze the following performance data and provide specific, actionable recommendations.

Target Platform: {target_platform}

{metrics_summary}

Detected Bottlenecks:
{bottleneck_summary if bottleneck_summary else "No major bottlenecks detected"}

Provide 3-5 specific optimization recommendations in JSON format:
{{
  "recommendations": [
    {{
      "title": "Short title",
      "description": "Detailed explanation",
      "category": "rendering|lighting|materials|meshes|memory|physics",
      "priority": "critical|high|medium|low",
      "estimated_improvement": "e.g., +10-15 FPS",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "auto_apply_available": true/false,
      "auto_apply_action": "Action description if auto-apply is available"
    }}
  ]
}}

Focus on practical, immediately actionable recommendations specific to the detected issues."""

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.7
            )
            
            result = json.loads(response.choices[0].message.content)
            recommendations = []
            
            for rec in result.get("recommendations", []):
                recommendations.append(OptimizationRecommendation(
                    id=str(uuid.uuid4()),
                    title=rec.get("title", "Optimization"),
                    description=rec.get("description", ""),
                    category=rec.get("category", "general"),
                    priority=OptimizationPriority(rec.get("priority", "medium")),
                    estimated_improvement=rec.get("estimated_improvement", "Unknown"),
                    steps=rec.get("steps", []),
                    auto_apply_available=rec.get("auto_apply_available", False),
                    auto_apply_action=rec.get("auto_apply_action")
                ))
            
            return recommendations
            
        except Exception as e:
            print(f"AI recommendation generation failed: {e}")
            return self._get_fallback_recommendations(bottlenecks)
    
    def _get_fallback_recommendations(self, bottlenecks: List[Bottleneck]) -> List[OptimizationRecommendation]:
        """Generate fallback recommendations based on bottlenecks"""
        recommendations = []
        
        for bottleneck in bottlenecks[:3]:
            if bottleneck.type == BottleneckType.DRAW_CALLS:
                recommendations.append(OptimizationRecommendation(
                    id=str(uuid.uuid4()),
                    title="Reduce Draw Calls",
                    description="Merge static meshes and enable instancing to reduce draw call overhead",
                    category="rendering",
                    priority=bottleneck.severity,
                    estimated_improvement="+5-15 FPS",
                    steps=[
                        "Select multiple static meshes in the scene",
                        "Use Actor > Merge Actors to combine them",
                        "Enable instanced rendering for repeated meshes",
                        "Use Hierarchical LODs for distant objects"
                    ],
                    auto_apply_available=True,
                    auto_apply_action="merge_static_meshes"
                ))
            elif bottleneck.type == BottleneckType.LIGHTS:
                recommendations.append(OptimizationRecommendation(
                    id=str(uuid.uuid4()),
                    title="Optimize Lighting",
                    description="Reduce dynamic light count and convert to static where possible",
                    category="lighting",
                    priority=bottleneck.severity,
                    estimated_improvement="+5-20 FPS",
                    steps=[
                        "Identify lights that don't need to be dynamic",
                        "Convert to Static or Stationary mobility",
                        "Reduce light radius where possible",
                        "Disable shadow casting on fill lights"
                    ],
                    auto_apply_available=True,
                    auto_apply_action="optimize_lights"
                ))
            elif bottleneck.type == BottleneckType.TRIANGLES:
                recommendations.append(OptimizationRecommendation(
                    id=str(uuid.uuid4()),
                    title="Implement LOD System",
                    description="Add Level of Detail meshes to reduce triangle count at distance",
                    category="meshes",
                    priority=bottleneck.severity,
                    estimated_improvement="+3-10 FPS",
                    steps=[
                        "Identify high-poly meshes in the scene",
                        "Generate LODs using UE5's auto-LOD feature",
                        "Configure LOD distances appropriately",
                        "Enable Nanite for supported meshes"
                    ],
                    auto_apply_available=True,
                    auto_apply_action="generate_lods"
                ))
        
        return recommendations
    
    async def _generate_ai_summary(
        self,
        metrics: PerformanceMetrics,
        bottlenecks: List[Bottleneck],
        recommendations: List[OptimizationRecommendation],
        target_platform: str,
        model: str
    ) -> str:
        """Generate a natural language summary of the performance analysis"""
        
        prompt = f"""Summarize this UE5 performance analysis in 2-3 sentences:

Target: {target_platform}
FPS: {metrics.fps:.1f}
Main Issues: {', '.join([b.title for b in bottlenecks[:3]]) if bottlenecks else 'None detected'}
Top Recommendation: {recommendations[0].title if recommendations else 'Scene is well optimized'}

Be concise and actionable. Start with the overall status, then mention the most impactful improvement."""

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=150
            )
            return response.choices[0].message.content.strip()
        except Exception:
            # Fallback summary
            if not bottlenecks:
                return f"Performance is excellent for {target_platform}. No major optimizations needed."
            else:
                return f"Performance needs attention. Main issue: {bottlenecks[0].title}. Recommended action: {recommendations[0].title if recommendations else 'Review bottlenecks'}."
    
    def _compare_with_previous(
        self,
        current: PerformanceMetrics,
        previous: PerformanceMetrics
    ) -> Dict[str, Any]:
        """Compare current metrics with previous report"""
        return {
            "fps_change": current.fps - previous.fps,
            "fps_change_percent": ((current.fps - previous.fps) / previous.fps * 100) if previous.fps > 0 else 0,
            "draw_calls_change": current.draw_calls - previous.draw_calls,
            "triangles_change": current.triangles_drawn - previous.triangles_drawn,
            "memory_change_mb": current.texture_memory_mb - previous.texture_memory_mb,
            "improved": current.fps > previous.fps
        }
    
    def get_report(self, report_id: str) -> Optional[PerformanceReport]:
        """Get a specific report by ID"""
        return self.reports.get(report_id)
    
    def get_all_reports(self) -> List[Dict[str, Any]]:
        """Get summary of all reports"""
        return [
            {
                "id": r.id,
                "timestamp": r.timestamp,
                "score": r.overall_score,
                "grade": r.performance_grade,
                "platform": r.target_platform,
                "fps": r.metrics.fps,
                "bottleneck_count": len(r.bottlenecks)
            }
            for r in self.reports.values()
        ]
    
    def get_metrics_history(self) -> List[Dict[str, Any]]:
        """Get historical metrics for charting"""
        return [
            {
                "timestamp": m.timestamp,
                "fps": m.fps,
                "frame_time_ms": m.frame_time_ms,
                "draw_calls": m.draw_calls,
                "triangles": m.triangles_drawn,
                "memory_mb": m.texture_memory_mb
            }
            for m in self.metrics_history
        ]
    
    def report_to_dict(self, report: PerformanceReport) -> Dict[str, Any]:
        """Convert report to dictionary for JSON serialization"""
        return {
            "id": report.id,
            "timestamp": report.timestamp,
            "overall_score": report.overall_score,
            "performance_grade": report.performance_grade,
            "target_platform": report.target_platform,
            "ai_summary": report.ai_summary,
            "metrics": {
                "fps": report.metrics.fps,
                "frame_time_ms": report.metrics.frame_time_ms,
                "game_thread_ms": report.metrics.game_thread_ms,
                "render_thread_ms": report.metrics.render_thread_ms,
                "gpu_time_ms": report.metrics.gpu_time_ms,
                "used_memory_mb": report.metrics.used_memory_mb,
                "texture_memory_mb": report.metrics.texture_memory_mb,
                "mesh_memory_mb": report.metrics.mesh_memory_mb,
                "draw_calls": report.metrics.draw_calls,
                "triangles_drawn": report.metrics.triangles_drawn,
                "visible_static_meshes": report.metrics.visible_static_meshes,
                "visible_skeletal_meshes": report.metrics.visible_skeletal_meshes,
                "dynamic_lights": report.metrics.dynamic_lights,
                "shadow_casting_lights": report.metrics.shadow_casting_lights,
                "material_count": report.metrics.material_count,
                "physics_bodies": report.metrics.physics_bodies
            },
            "bottlenecks": [
                {
                    "id": b.id,
                    "type": b.type.value,
                    "severity": b.severity.value,
                    "title": b.title,
                    "description": b.description,
                    "current_value": b.current_value,
                    "recommended_value": b.recommended_value,
                    "impact_estimate": b.impact_estimate,
                    "auto_fix_available": b.auto_fix_available,
                    "auto_fix_action": b.auto_fix_action
                }
                for b in report.bottlenecks
            ],
            "recommendations": [
                {
                    "id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "category": r.category,
                    "priority": r.priority.value,
                    "estimated_improvement": r.estimated_improvement,
                    "steps": r.steps,
                    "auto_apply_available": r.auto_apply_available,
                    "auto_apply_action": r.auto_apply_action
                }
                for r in report.recommendations
            ],
            "comparison": report.comparison_with_previous
        }


# Global service instance
performance_analyzer_service = PerformanceAnalyzerService()
