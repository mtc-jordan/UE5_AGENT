"""
Scene Analyzer Service

AI-powered scene understanding and analysis:
- Scene composition analysis
- Issue detection (overlapping meshes, missing lights, etc.)
- Smart recommendations
- Complexity metrics
- Performance predictions
"""

import json
import math
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, field, asdict
from enum import Enum
import os

# Try to import OpenAI
try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


class IssueSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class IssueCategory(str, Enum):
    PERFORMANCE = "performance"
    LIGHTING = "lighting"
    COLLISION = "collision"
    ORGANIZATION = "organization"
    MATERIALS = "materials"
    SCALE = "scale"
    PLACEMENT = "placement"


@dataclass
class SceneIssue:
    """Represents a detected issue in the scene"""
    id: str
    category: IssueCategory
    severity: IssueSeverity
    title: str
    description: str
    affected_actors: List[str]
    suggestion: str
    auto_fix_available: bool = False
    auto_fix_command: Optional[str] = None


@dataclass
class SceneRecommendation:
    """AI-generated recommendation for scene improvement"""
    id: str
    title: str
    description: str
    priority: int  # 1-5, 5 being highest
    category: str
    action_prompt: Optional[str] = None  # Prompt to execute the recommendation


@dataclass
class ActorInfo:
    """Detailed information about an actor"""
    name: str
    type: str
    class_name: str
    location: Tuple[float, float, float]
    rotation: Tuple[float, float, float]
    scale: Tuple[float, float, float]
    is_visible: bool = True
    has_collision: bool = False
    material_count: int = 0
    triangle_count: int = 0
    tags: List[str] = field(default_factory=list)


@dataclass
class SceneMetrics:
    """Scene complexity and performance metrics"""
    total_actors: int = 0
    static_meshes: int = 0
    skeletal_meshes: int = 0
    lights: int = 0
    cameras: int = 0
    particle_systems: int = 0
    blueprints: int = 0
    
    total_triangles: int = 0
    total_materials: int = 0
    unique_materials: int = 0
    
    scene_bounds_min: Tuple[float, float, float] = (0, 0, 0)
    scene_bounds_max: Tuple[float, float, float] = (0, 0, 0)
    scene_center: Tuple[float, float, float] = (0, 0, 0)
    
    complexity_score: float = 0.0  # 0-100
    performance_prediction: str = "Unknown"
    
    actors_by_type: Dict[str, int] = field(default_factory=dict)
    actors_by_folder: Dict[str, int] = field(default_factory=dict)


@dataclass
class SceneAnalysis:
    """Complete scene analysis result"""
    id: str
    timestamp: str
    project_name: str
    level_name: str
    
    # Scene description
    description: str
    summary: str
    
    # Metrics
    metrics: SceneMetrics
    
    # Actors
    actors: List[ActorInfo]
    
    # Issues and recommendations
    issues: List[SceneIssue]
    recommendations: List[SceneRecommendation]
    
    # AI insights
    ai_insights: str
    scene_type: str  # e.g., "Interior", "Exterior", "Game Level", etc.
    mood: str  # e.g., "Dark", "Bright", "Mysterious", etc.


class SceneAnalyzerService:
    """Service for AI-powered scene analysis"""
    
    def __init__(self):
        self.analyses: Dict[str, SceneAnalysis] = {}
        self.client = None
        if HAS_OPENAI:
            self.client = AsyncOpenAI()
    
    async def analyze_scene(
        self,
        scene_data: Dict[str, Any],
        screenshot_base64: Optional[str] = None,
        model: str = "gpt-4.1-mini"
    ) -> SceneAnalysis:
        """
        Perform comprehensive scene analysis
        
        Args:
            scene_data: Raw scene data from UE5 (actors, properties, etc.)
            screenshot_base64: Optional viewport screenshot for visual analysis
            model: AI model to use for analysis
        """
        analysis_id = f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Parse actors from scene data
        actors = self._parse_actors(scene_data)
        
        # Calculate metrics
        metrics = self._calculate_metrics(actors, scene_data)
        
        # Detect issues
        issues = self._detect_issues(actors, metrics)
        
        # Generate AI insights
        ai_insights, scene_type, mood, description, summary = await self._generate_ai_insights(
            actors, metrics, issues, screenshot_base64, model
        )
        
        # Generate recommendations
        recommendations = await self._generate_recommendations(
            actors, metrics, issues, scene_type, model
        )
        
        # Create analysis result
        analysis = SceneAnalysis(
            id=analysis_id,
            timestamp=datetime.now().isoformat(),
            project_name=scene_data.get("project_name", "Unknown"),
            level_name=scene_data.get("level_name", "Unknown"),
            description=description,
            summary=summary,
            metrics=metrics,
            actors=actors,
            issues=issues,
            recommendations=recommendations,
            ai_insights=ai_insights,
            scene_type=scene_type,
            mood=mood
        )
        
        self.analyses[analysis_id] = analysis
        return analysis
    
    def _parse_actors(self, scene_data: Dict[str, Any]) -> List[ActorInfo]:
        """Parse actor information from scene data"""
        actors = []
        raw_actors = scene_data.get("actors", [])
        
        for actor_data in raw_actors:
            # Parse location
            loc = actor_data.get("location", {})
            location = (
                float(loc.get("x", 0)),
                float(loc.get("y", 0)),
                float(loc.get("z", 0))
            )
            
            # Parse rotation
            rot = actor_data.get("rotation", {})
            rotation = (
                float(rot.get("pitch", rot.get("x", 0))),
                float(rot.get("yaw", rot.get("y", 0))),
                float(rot.get("roll", rot.get("z", 0)))
            )
            
            # Parse scale
            scl = actor_data.get("scale", {})
            if isinstance(scl, dict):
                scale = (
                    float(scl.get("x", 1)),
                    float(scl.get("y", 1)),
                    float(scl.get("z", 1))
                )
            else:
                scale = (1.0, 1.0, 1.0)
            
            actor = ActorInfo(
                name=actor_data.get("name", "Unknown"),
                type=actor_data.get("type", "Unknown"),
                class_name=actor_data.get("class", actor_data.get("class_name", "Unknown")),
                location=location,
                rotation=rotation,
                scale=scale,
                is_visible=actor_data.get("visible", True),
                has_collision=actor_data.get("has_collision", False),
                material_count=actor_data.get("material_count", 0),
                triangle_count=actor_data.get("triangle_count", 0),
                tags=actor_data.get("tags", [])
            )
            actors.append(actor)
        
        return actors
    
    def _calculate_metrics(self, actors: List[ActorInfo], scene_data: Dict[str, Any]) -> SceneMetrics:
        """Calculate scene metrics from actors"""
        metrics = SceneMetrics()
        metrics.total_actors = len(actors)
        
        # Count by type
        type_counts = {}
        all_locations = []
        
        for actor in actors:
            actor_type = actor.type.lower()
            type_counts[actor_type] = type_counts.get(actor_type, 0) + 1
            all_locations.append(actor.location)
            
            # Categorize
            if "staticmesh" in actor_type or "static" in actor_type:
                metrics.static_meshes += 1
            elif "skeletal" in actor_type:
                metrics.skeletal_meshes += 1
            elif "light" in actor_type:
                metrics.lights += 1
            elif "camera" in actor_type:
                metrics.cameras += 1
            elif "particle" in actor_type or "niagara" in actor_type or "cascade" in actor_type:
                metrics.particle_systems += 1
            elif "blueprint" in actor_type or "bp_" in actor.name.lower():
                metrics.blueprints += 1
            
            # Accumulate
            metrics.total_triangles += actor.triangle_count
            metrics.total_materials += actor.material_count
        
        metrics.actors_by_type = type_counts
        
        # Calculate bounds
        if all_locations:
            xs = [loc[0] for loc in all_locations]
            ys = [loc[1] for loc in all_locations]
            zs = [loc[2] for loc in all_locations]
            
            metrics.scene_bounds_min = (min(xs), min(ys), min(zs))
            metrics.scene_bounds_max = (max(xs), max(ys), max(zs))
            metrics.scene_center = (
                (min(xs) + max(xs)) / 2,
                (min(ys) + max(ys)) / 2,
                (min(zs) + max(zs)) / 2
            )
        
        # Calculate complexity score (0-100)
        complexity = 0
        complexity += min(metrics.total_actors * 0.5, 30)  # Max 30 from actor count
        complexity += min(metrics.total_triangles / 100000, 30)  # Max 30 from triangles
        complexity += min(metrics.lights * 2, 15)  # Max 15 from lights
        complexity += min(metrics.particle_systems * 5, 15)  # Max 15 from particles
        complexity += min(metrics.skeletal_meshes * 3, 10)  # Max 10 from skeletal meshes
        metrics.complexity_score = min(complexity, 100)
        
        # Performance prediction
        if metrics.complexity_score < 30:
            metrics.performance_prediction = "Excellent"
        elif metrics.complexity_score < 50:
            metrics.performance_prediction = "Good"
        elif metrics.complexity_score < 70:
            metrics.performance_prediction = "Moderate"
        elif metrics.complexity_score < 85:
            metrics.performance_prediction = "Heavy"
        else:
            metrics.performance_prediction = "Very Heavy"
        
        return metrics
    
    def _detect_issues(self, actors: List[ActorInfo], metrics: SceneMetrics) -> List[SceneIssue]:
        """Detect potential issues in the scene"""
        issues = []
        issue_id = 0
        
        # Check for missing lights
        if metrics.lights == 0 and metrics.total_actors > 0:
            issues.append(SceneIssue(
                id=f"issue_{issue_id}",
                category=IssueCategory.LIGHTING,
                severity=IssueSeverity.WARNING,
                title="No Lights in Scene",
                description="The scene has no light sources. Objects may appear completely dark.",
                affected_actors=[],
                suggestion="Add at least one directional light or sky light for basic illumination.",
                auto_fix_available=True,
                auto_fix_command="spawn_actor with type DirectionalLight"
            ))
            issue_id += 1
        
        # Check for too many lights
        if metrics.lights > 20:
            issues.append(SceneIssue(
                id=f"issue_{issue_id}",
                category=IssueCategory.PERFORMANCE,
                severity=IssueSeverity.WARNING,
                title="High Light Count",
                description=f"Scene has {metrics.lights} lights which may impact performance.",
                affected_actors=[a.name for a in actors if "light" in a.type.lower()],
                suggestion="Consider baking static lights or reducing dynamic light count.",
                auto_fix_available=False
            ))
            issue_id += 1
        
        # Check for overlapping actors (same position)
        positions = {}
        for actor in actors:
            pos_key = f"{int(actor.location[0])}_{int(actor.location[1])}_{int(actor.location[2])}"
            if pos_key in positions:
                positions[pos_key].append(actor.name)
            else:
                positions[pos_key] = [actor.name]
        
        for pos_key, actor_names in positions.items():
            if len(actor_names) > 1:
                issues.append(SceneIssue(
                    id=f"issue_{issue_id}",
                    category=IssueCategory.PLACEMENT,
                    severity=IssueSeverity.WARNING,
                    title="Overlapping Actors",
                    description=f"{len(actor_names)} actors are at the same position.",
                    affected_actors=actor_names,
                    suggestion="Move actors apart to avoid z-fighting and collision issues.",
                    auto_fix_available=False
                ))
                issue_id += 1
        
        # Check for extreme scales
        for actor in actors:
            if any(s > 100 or s < 0.01 for s in actor.scale if s != 0):
                issues.append(SceneIssue(
                    id=f"issue_{issue_id}",
                    category=IssueCategory.SCALE,
                    severity=IssueSeverity.INFO,
                    title="Extreme Scale Value",
                    description=f"Actor '{actor.name}' has unusual scale values.",
                    affected_actors=[actor.name],
                    suggestion="Consider using properly scaled meshes instead of extreme scaling.",
                    auto_fix_available=False
                ))
                issue_id += 1
        
        # Check for actors far from origin
        for actor in actors:
            distance = math.sqrt(sum(c**2 for c in actor.location))
            if distance > 100000:  # 1km in UE units
                issues.append(SceneIssue(
                    id=f"issue_{issue_id}",
                    category=IssueCategory.PLACEMENT,
                    severity=IssueSeverity.WARNING,
                    title="Actor Far From Origin",
                    description=f"Actor '{actor.name}' is very far from the world origin ({distance:.0f} units).",
                    affected_actors=[actor.name],
                    suggestion="Large distances from origin can cause floating-point precision issues.",
                    auto_fix_available=False
                ))
                issue_id += 1
        
        # Check for high triangle count
        if metrics.total_triangles > 5000000:
            issues.append(SceneIssue(
                id=f"issue_{issue_id}",
                category=IssueCategory.PERFORMANCE,
                severity=IssueSeverity.ERROR,
                title="Very High Triangle Count",
                description=f"Scene has {metrics.total_triangles:,} triangles which may cause performance issues.",
                affected_actors=[],
                suggestion="Consider using LODs, mesh simplification, or culling.",
                auto_fix_available=False
            ))
            issue_id += 1
        
        # Check for no camera
        if metrics.cameras == 0:
            issues.append(SceneIssue(
                id=f"issue_{issue_id}",
                category=IssueCategory.ORGANIZATION,
                severity=IssueSeverity.INFO,
                title="No Camera in Scene",
                description="The scene has no camera actors.",
                affected_actors=[],
                suggestion="Add a camera if you need specific viewpoints for cinematics or gameplay.",
                auto_fix_available=True,
                auto_fix_command="spawn_actor with type CameraActor"
            ))
            issue_id += 1
        
        return issues
    
    async def _generate_ai_insights(
        self,
        actors: List[ActorInfo],
        metrics: SceneMetrics,
        issues: List[SceneIssue],
        screenshot_base64: Optional[str],
        model: str
    ) -> Tuple[str, str, str, str, str]:
        """Generate AI-powered insights about the scene"""
        
        if not self.client:
            return (
                "AI analysis unavailable - OpenAI client not configured.",
                "Unknown",
                "Unknown",
                "Scene contains various actors.",
                f"Scene with {metrics.total_actors} actors."
            )
        
        # Build context for AI
        actor_summary = {}
        for actor in actors[:50]:  # Limit to first 50 actors
            actor_type = actor.type
            if actor_type not in actor_summary:
                actor_summary[actor_type] = []
            actor_summary[actor_type].append(actor.name)
        
        context = f"""
Scene Analysis Context:
- Total Actors: {metrics.total_actors}
- Static Meshes: {metrics.static_meshes}
- Skeletal Meshes: {metrics.skeletal_meshes}
- Lights: {metrics.lights}
- Cameras: {metrics.cameras}
- Particle Systems: {metrics.particle_systems}
- Complexity Score: {metrics.complexity_score:.1f}/100
- Performance Prediction: {metrics.performance_prediction}
- Issues Found: {len(issues)}

Actor Types and Names:
{json.dumps(actor_summary, indent=2)}

Scene Bounds:
- Min: {metrics.scene_bounds_min}
- Max: {metrics.scene_bounds_max}
- Center: {metrics.scene_center}
"""
        
        try:
            messages = [
                {
                    "role": "system",
                    "content": """You are an expert Unreal Engine 5 scene analyst. Analyze the scene data and provide:
1. A detailed description of what the scene appears to be (2-3 sentences)
2. A one-line summary
3. The scene type (e.g., "Interior Living Room", "Exterior Forest", "Game Level", "Architectural Visualization")
4. The mood/atmosphere (e.g., "Bright and Cheerful", "Dark and Mysterious", "Professional", "Playful")
5. Key insights about the scene composition and any notable patterns

Respond in JSON format:
{
    "description": "...",
    "summary": "...",
    "scene_type": "...",
    "mood": "...",
    "insights": "..."
}"""
                },
                {
                    "role": "user",
                    "content": context
                }
            ]
            
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content
            
            # Parse JSON response
            try:
                # Clean up the response
                if "```json" in result_text:
                    result_text = result_text.split("```json")[1].split("```")[0]
                elif "```" in result_text:
                    result_text = result_text.split("```")[1].split("```")[0]
                
                result = json.loads(result_text.strip())
                return (
                    result.get("insights", ""),
                    result.get("scene_type", "Unknown"),
                    result.get("mood", "Unknown"),
                    result.get("description", ""),
                    result.get("summary", "")
                )
            except json.JSONDecodeError:
                return (
                    result_text,
                    "Unknown",
                    "Unknown",
                    "Scene analysis completed.",
                    f"Scene with {metrics.total_actors} actors."
                )
                
        except Exception as e:
            return (
                f"AI analysis error: {str(e)}",
                "Unknown",
                "Unknown",
                "Scene contains various actors.",
                f"Scene with {metrics.total_actors} actors."
            )
    
    async def _generate_recommendations(
        self,
        actors: List[ActorInfo],
        metrics: SceneMetrics,
        issues: List[SceneIssue],
        scene_type: str,
        model: str
    ) -> List[SceneRecommendation]:
        """Generate AI-powered recommendations"""
        recommendations = []
        rec_id = 0
        
        # Rule-based recommendations
        if metrics.lights == 0:
            recommendations.append(SceneRecommendation(
                id=f"rec_{rec_id}",
                title="Add Basic Lighting",
                description="Add a directional light and sky light for proper scene illumination.",
                priority=5,
                category="lighting",
                action_prompt="Add a directional light pointing downward and a sky light to the scene"
            ))
            rec_id += 1
        
        if metrics.lights == 1:
            recommendations.append(SceneRecommendation(
                id=f"rec_{rec_id}",
                title="Enhance Lighting Setup",
                description="Consider adding fill lights or ambient lighting for better visual quality.",
                priority=3,
                category="lighting",
                action_prompt="Add two point lights as fill lights to reduce harsh shadows"
            ))
            rec_id += 1
        
        if metrics.total_actors > 100 and metrics.complexity_score > 60:
            recommendations.append(SceneRecommendation(
                id=f"rec_{rec_id}",
                title="Optimize Scene Performance",
                description="Consider using Level Streaming, LODs, or HLOD for better performance.",
                priority=4,
                category="performance"
            ))
            rec_id += 1
        
        if metrics.static_meshes > 50 and metrics.total_materials > metrics.static_meshes:
            recommendations.append(SceneRecommendation(
                id=f"rec_{rec_id}",
                title="Consolidate Materials",
                description="Many unique materials detected. Consider using material instances or texture atlases.",
                priority=3,
                category="materials"
            ))
            rec_id += 1
        
        # AI-generated recommendations
        if self.client and len(recommendations) < 5:
            try:
                context = f"""
Scene Type: {scene_type}
Actors: {metrics.total_actors}
Lights: {metrics.lights}
Complexity: {metrics.complexity_score:.1f}/100
Current Issues: {len(issues)}
"""
                response = await self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {
                            "role": "system",
                            "content": """You are a UE5 expert. Based on the scene context, suggest 2-3 specific improvements.
Each recommendation should be actionable and specific to UE5.
Respond in JSON format:
[
    {"title": "...", "description": "...", "priority": 1-5, "category": "...", "action_prompt": "..."}
]"""
                        },
                        {"role": "user", "content": context}
                    ],
                    temperature=0.7,
                    max_tokens=400
                )
                
                result_text = response.choices[0].message.content
                if "```json" in result_text:
                    result_text = result_text.split("```json")[1].split("```")[0]
                elif "```" in result_text:
                    result_text = result_text.split("```")[1].split("```")[0]
                
                ai_recs = json.loads(result_text.strip())
                for rec in ai_recs:
                    recommendations.append(SceneRecommendation(
                        id=f"rec_{rec_id}",
                        title=rec.get("title", ""),
                        description=rec.get("description", ""),
                        priority=rec.get("priority", 3),
                        category=rec.get("category", "general"),
                        action_prompt=rec.get("action_prompt")
                    ))
                    rec_id += 1
                    
            except Exception:
                pass  # Silently fail for AI recommendations
        
        # Sort by priority
        recommendations.sort(key=lambda r: r.priority, reverse=True)
        
        return recommendations[:8]  # Limit to 8 recommendations
    
    async def get_scene_description(self, scene_data: Dict[str, Any], model: str = "gpt-4.1-mini") -> str:
        """Get a natural language description of the scene"""
        actors = self._parse_actors(scene_data)
        metrics = self._calculate_metrics(actors, scene_data)
        
        if not self.client:
            return f"Scene contains {metrics.total_actors} actors including {metrics.static_meshes} static meshes, {metrics.lights} lights, and {metrics.cameras} cameras."
        
        actor_names = [a.name for a in actors[:20]]
        
        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are describing a 3D scene in Unreal Engine. Provide a natural, conversational description of what the scene contains and what it might be used for. Keep it to 2-3 sentences."
                    },
                    {
                        "role": "user",
                        "content": f"Actors in scene: {actor_names}\nTotal actors: {metrics.total_actors}\nLights: {metrics.lights}\nMeshes: {metrics.static_meshes}"
                    }
                ],
                temperature=0.7,
                max_tokens=150
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Scene contains {metrics.total_actors} actors."
    
    def get_analysis(self, analysis_id: str) -> Optional[SceneAnalysis]:
        """Get a previously generated analysis"""
        return self.analyses.get(analysis_id)
    
    def get_all_analyses(self) -> List[Dict[str, Any]]:
        """Get all analyses (summary only)"""
        return [
            {
                "id": a.id,
                "timestamp": a.timestamp,
                "project_name": a.project_name,
                "level_name": a.level_name,
                "summary": a.summary,
                "total_actors": a.metrics.total_actors,
                "issues_count": len(a.issues),
                "complexity_score": a.metrics.complexity_score
            }
            for a in self.analyses.values()
        ]
    
    def analysis_to_dict(self, analysis: SceneAnalysis) -> Dict[str, Any]:
        """Convert analysis to dictionary for JSON serialization"""
        return {
            "id": analysis.id,
            "timestamp": analysis.timestamp,
            "project_name": analysis.project_name,
            "level_name": analysis.level_name,
            "description": analysis.description,
            "summary": analysis.summary,
            "metrics": {
                "total_actors": analysis.metrics.total_actors,
                "static_meshes": analysis.metrics.static_meshes,
                "skeletal_meshes": analysis.metrics.skeletal_meshes,
                "lights": analysis.metrics.lights,
                "cameras": analysis.metrics.cameras,
                "particle_systems": analysis.metrics.particle_systems,
                "blueprints": analysis.metrics.blueprints,
                "total_triangles": analysis.metrics.total_triangles,
                "total_materials": analysis.metrics.total_materials,
                "scene_bounds_min": analysis.metrics.scene_bounds_min,
                "scene_bounds_max": analysis.metrics.scene_bounds_max,
                "scene_center": analysis.metrics.scene_center,
                "complexity_score": analysis.metrics.complexity_score,
                "performance_prediction": analysis.metrics.performance_prediction,
                "actors_by_type": analysis.metrics.actors_by_type
            },
            "actors": [
                {
                    "name": a.name,
                    "type": a.type,
                    "class_name": a.class_name,
                    "location": a.location,
                    "rotation": a.rotation,
                    "scale": a.scale,
                    "is_visible": a.is_visible,
                    "has_collision": a.has_collision,
                    "material_count": a.material_count,
                    "triangle_count": a.triangle_count,
                    "tags": a.tags
                }
                for a in analysis.actors
            ],
            "issues": [
                {
                    "id": i.id,
                    "category": i.category.value,
                    "severity": i.severity.value,
                    "title": i.title,
                    "description": i.description,
                    "affected_actors": i.affected_actors,
                    "suggestion": i.suggestion,
                    "auto_fix_available": i.auto_fix_available,
                    "auto_fix_command": i.auto_fix_command
                }
                for i in analysis.issues
            ],
            "recommendations": [
                {
                    "id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "priority": r.priority,
                    "category": r.category,
                    "action_prompt": r.action_prompt
                }
                for r in analysis.recommendations
            ],
            "ai_insights": analysis.ai_insights,
            "scene_type": analysis.scene_type,
            "mood": analysis.mood
        }


# Global service instance
scene_analyzer_service = SceneAnalyzerService()
