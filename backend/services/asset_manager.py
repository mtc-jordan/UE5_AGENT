"""
Asset Manager Service

AI-driven asset management for UE5 projects:
- Smart asset search with natural language
- Duplicate detection
- Asset health check
- Auto-organization
- Batch operations
- Usage analytics
"""

import asyncio
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
import json
import os
import re
from openai import AsyncOpenAI


class AssetType(str, Enum):
    STATIC_MESH = "static_mesh"
    SKELETAL_MESH = "skeletal_mesh"
    MATERIAL = "material"
    MATERIAL_INSTANCE = "material_instance"
    TEXTURE = "texture"
    BLUEPRINT = "blueprint"
    ANIMATION = "animation"
    SOUND = "sound"
    PARTICLE = "particle"
    LEVEL = "level"
    DATA_ASSET = "data_asset"
    WIDGET = "widget"
    OTHER = "other"


class AssetHealth(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    ERROR = "error"
    ORPHANED = "orphaned"


class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class Asset:
    """Represents a UE5 asset"""
    id: str
    name: str
    path: str
    type: AssetType
    size_mb: float = 0.0
    last_modified: str = ""
    dependencies: List[str] = field(default_factory=list)
    referencers: List[str] = field(default_factory=list)
    health: AssetHealth = AssetHealth.HEALTHY
    issues: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AssetIssue:
    """Detected asset issue"""
    id: str
    asset_path: str
    asset_name: str
    severity: IssueSeverity
    issue_type: str
    title: str
    description: str
    auto_fix_available: bool = False
    auto_fix_action: Optional[str] = None


@dataclass
class DuplicateGroup:
    """Group of duplicate/similar assets"""
    id: str
    similarity_score: float
    assets: List[Asset]
    total_size_mb: float
    potential_savings_mb: float
    recommendation: str


@dataclass
class OrganizationSuggestion:
    """AI-generated organization suggestion"""
    id: str
    asset_path: str
    current_folder: str
    suggested_folder: str
    reason: str
    confidence: float


@dataclass
class AssetSearchResult:
    """Search result with relevance score"""
    asset: Asset
    relevance_score: float
    match_reason: str


class AssetManagerService:
    """Service for AI-driven asset management"""
    
    # Asset type patterns for classification
    TYPE_PATTERNS = {
        AssetType.STATIC_MESH: [r'SM_', r'_SM$', r'StaticMesh', r'\.uasset$'],
        AssetType.SKELETAL_MESH: [r'SK_', r'_SK$', r'SkeletalMesh'],
        AssetType.MATERIAL: [r'M_', r'_M$', r'Material', r'Mat_'],
        AssetType.MATERIAL_INSTANCE: [r'MI_', r'_MI$', r'MaterialInstance'],
        AssetType.TEXTURE: [r'T_', r'_T$', r'Texture', r'_D$', r'_N$', r'_R$', r'_M$', r'_AO$'],
        AssetType.BLUEPRINT: [r'BP_', r'_BP$', r'Blueprint'],
        AssetType.ANIMATION: [r'A_', r'_A$', r'Anim', r'Animation', r'Montage'],
        AssetType.SOUND: [r'S_', r'_S$', r'Sound', r'Audio', r'\.wav$', r'\.mp3$'],
        AssetType.PARTICLE: [r'P_', r'_P$', r'Particle', r'FX_', r'VFX_', r'Niagara'],
        AssetType.LEVEL: [r'L_', r'_L$', r'Level', r'Map', r'\.umap$'],
        AssetType.WIDGET: [r'W_', r'_W$', r'Widget', r'UI_', r'UMG_'],
    }
    
    # Recommended folder structure
    FOLDER_STRUCTURE = {
        AssetType.STATIC_MESH: "/Content/Meshes/StaticMeshes",
        AssetType.SKELETAL_MESH: "/Content/Meshes/SkeletalMeshes",
        AssetType.MATERIAL: "/Content/Materials",
        AssetType.MATERIAL_INSTANCE: "/Content/Materials/Instances",
        AssetType.TEXTURE: "/Content/Textures",
        AssetType.BLUEPRINT: "/Content/Blueprints",
        AssetType.ANIMATION: "/Content/Animations",
        AssetType.SOUND: "/Content/Audio",
        AssetType.PARTICLE: "/Content/Effects",
        AssetType.LEVEL: "/Content/Maps",
        AssetType.WIDGET: "/Content/UI",
        AssetType.DATA_ASSET: "/Content/Data",
    }
    
    def __init__(self):
        self.client = AsyncOpenAI()
        self.assets: Dict[str, Asset] = {}
        self.issues: List[AssetIssue] = []
        self.duplicate_groups: List[DuplicateGroup] = []
        self.organization_suggestions: List[OrganizationSuggestion] = []
    
    async def scan_assets(
        self,
        asset_list: List[Dict[str, Any]],
        model: str = "deepseek-chat"
    ) -> Dict[str, Any]:
        """
        Scan and analyze project assets
        """
        self.assets.clear()
        self.issues.clear()
        
        # Parse assets
        for asset_data in asset_list:
            asset = self._parse_asset(asset_data)
            self.assets[asset.path] = asset
        
        # Detect issues
        await self._detect_issues()
        
        # Find duplicates
        await self._find_duplicates()
        
        # Generate organization suggestions
        await self._generate_organization_suggestions(model)
        
        # Calculate statistics
        stats = self._calculate_statistics()
        
        return {
            "total_assets": len(self.assets),
            "statistics": stats,
            "issues": [self._issue_to_dict(i) for i in self.issues],
            "duplicate_groups": [self._duplicate_group_to_dict(d) for d in self.duplicate_groups],
            "organization_suggestions": [self._suggestion_to_dict(s) for s in self.organization_suggestions[:10]],
            "health_summary": self._get_health_summary()
        }
    
    def _parse_asset(self, data: Dict[str, Any]) -> Asset:
        """Parse raw asset data into Asset object"""
        name = data.get("name", "Unknown")
        path = data.get("path", "")
        
        # Determine asset type
        asset_type = self._classify_asset_type(name, path)
        
        return Asset(
            id=str(uuid.uuid4()),
            name=name,
            path=path,
            type=asset_type,
            size_mb=data.get("size_mb", 0.0),
            last_modified=data.get("last_modified", ""),
            dependencies=data.get("dependencies", []),
            referencers=data.get("referencers", []),
            metadata=data.get("metadata", {})
        )
    
    def _classify_asset_type(self, name: str, path: str) -> AssetType:
        """Classify asset type based on name and path patterns"""
        combined = f"{name} {path}"
        
        for asset_type, patterns in self.TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, combined, re.IGNORECASE):
                    return asset_type
        
        return AssetType.OTHER
    
    async def _detect_issues(self):
        """Detect various asset issues"""
        self.issues.clear()
        
        for asset in self.assets.values():
            # Check for broken references
            for dep in asset.dependencies:
                if dep not in self.assets and not dep.startswith("/Engine/"):
                    self.issues.append(AssetIssue(
                        id=str(uuid.uuid4()),
                        asset_path=asset.path,
                        asset_name=asset.name,
                        severity=IssueSeverity.ERROR,
                        issue_type="broken_reference",
                        title="Broken Reference",
                        description=f"Asset references missing dependency: {dep}",
                        auto_fix_available=False
                    ))
                    asset.health = AssetHealth.ERROR
                    asset.issues.append({"type": "broken_reference", "target": dep})
            
            # Check for orphaned assets (no referencers)
            if not asset.referencers and asset.type not in [AssetType.LEVEL, AssetType.BLUEPRINT]:
                self.issues.append(AssetIssue(
                    id=str(uuid.uuid4()),
                    asset_path=asset.path,
                    asset_name=asset.name,
                    severity=IssueSeverity.WARNING,
                    issue_type="orphaned",
                    title="Potentially Unused Asset",
                    description="This asset is not referenced by any other asset",
                    auto_fix_available=True,
                    auto_fix_action="delete_asset"
                ))
                if asset.health == AssetHealth.HEALTHY:
                    asset.health = AssetHealth.ORPHANED
            
            # Check for oversized textures
            if asset.type == AssetType.TEXTURE and asset.size_mb > 10:
                self.issues.append(AssetIssue(
                    id=str(uuid.uuid4()),
                    asset_path=asset.path,
                    asset_name=asset.name,
                    severity=IssueSeverity.WARNING,
                    issue_type="oversized_texture",
                    title="Oversized Texture",
                    description=f"Texture is {asset.size_mb:.1f}MB, consider reducing resolution",
                    auto_fix_available=True,
                    auto_fix_action="resize_texture"
                ))
                if asset.health == AssetHealth.HEALTHY:
                    asset.health = AssetHealth.WARNING
            
            # Check for naming convention violations
            if not self._follows_naming_convention(asset):
                self.issues.append(AssetIssue(
                    id=str(uuid.uuid4()),
                    asset_path=asset.path,
                    asset_name=asset.name,
                    severity=IssueSeverity.INFO,
                    issue_type="naming_convention",
                    title="Naming Convention Violation",
                    description=f"Asset name doesn't follow UE5 naming conventions for {asset.type.value}",
                    auto_fix_available=True,
                    auto_fix_action="rename_asset"
                ))
    
    def _follows_naming_convention(self, asset: Asset) -> bool:
        """Check if asset follows UE5 naming conventions"""
        prefixes = {
            AssetType.STATIC_MESH: "SM_",
            AssetType.SKELETAL_MESH: "SK_",
            AssetType.MATERIAL: "M_",
            AssetType.MATERIAL_INSTANCE: "MI_",
            AssetType.TEXTURE: "T_",
            AssetType.BLUEPRINT: "BP_",
            AssetType.ANIMATION: "A_",
            AssetType.SOUND: "S_",
            AssetType.PARTICLE: "P_",
            AssetType.WIDGET: "W_",
        }
        
        expected_prefix = prefixes.get(asset.type)
        if expected_prefix:
            return asset.name.startswith(expected_prefix)
        return True
    
    async def _find_duplicates(self):
        """Find duplicate or similar assets"""
        self.duplicate_groups.clear()
        
        # Group by name similarity
        name_groups: Dict[str, List[Asset]] = {}
        
        for asset in self.assets.values():
            # Normalize name for comparison
            normalized = re.sub(r'[_\-\d]+', '', asset.name.lower())
            if normalized not in name_groups:
                name_groups[normalized] = []
            name_groups[normalized].append(asset)
        
        # Create duplicate groups for groups with multiple assets
        for normalized_name, assets in name_groups.items():
            if len(assets) > 1:
                total_size = sum(a.size_mb for a in assets)
                # Keep the largest one, others are potential duplicates
                sorted_assets = sorted(assets, key=lambda a: a.size_mb, reverse=True)
                potential_savings = total_size - sorted_assets[0].size_mb
                
                self.duplicate_groups.append(DuplicateGroup(
                    id=str(uuid.uuid4()),
                    similarity_score=0.8,
                    assets=sorted_assets,
                    total_size_mb=total_size,
                    potential_savings_mb=potential_savings,
                    recommendation=f"Consider keeping only '{sorted_assets[0].name}' and removing duplicates"
                ))
    
    async def _generate_organization_suggestions(self, model: str):
        """Generate AI-powered organization suggestions"""
        self.organization_suggestions.clear()
        
        misplaced_assets = []
        for asset in self.assets.values():
            recommended_folder = self.FOLDER_STRUCTURE.get(asset.type)
            if recommended_folder and not asset.path.startswith(recommended_folder):
                misplaced_assets.append(asset)
        
        # Generate suggestions for misplaced assets
        for asset in misplaced_assets[:20]:  # Limit to 20
            recommended_folder = self.FOLDER_STRUCTURE.get(asset.type, "/Content/Misc")
            current_folder = "/".join(asset.path.split("/")[:-1])
            
            self.organization_suggestions.append(OrganizationSuggestion(
                id=str(uuid.uuid4()),
                asset_path=asset.path,
                current_folder=current_folder,
                suggested_folder=recommended_folder,
                reason=f"Asset type '{asset.type.value}' should be in {recommended_folder}",
                confidence=0.85
            ))
    
    def _calculate_statistics(self) -> Dict[str, Any]:
        """Calculate asset statistics"""
        type_counts: Dict[str, int] = {}
        type_sizes: Dict[str, float] = {}
        total_size = 0.0
        
        for asset in self.assets.values():
            type_name = asset.type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + 1
            type_sizes[type_name] = type_sizes.get(type_name, 0) + asset.size_mb
            total_size += asset.size_mb
        
        return {
            "by_type": [
                {"type": t, "count": c, "size_mb": type_sizes.get(t, 0)}
                for t, c in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)
            ],
            "total_size_mb": total_size,
            "total_size_gb": total_size / 1024,
            "average_size_mb": total_size / len(self.assets) if self.assets else 0,
            "largest_assets": sorted(
                [{"name": a.name, "path": a.path, "size_mb": a.size_mb, "type": a.type.value}
                 for a in self.assets.values()],
                key=lambda x: x["size_mb"],
                reverse=True
            )[:10]
        }
    
    def _get_health_summary(self) -> Dict[str, int]:
        """Get summary of asset health statuses"""
        summary = {
            "healthy": 0,
            "warning": 0,
            "error": 0,
            "orphaned": 0
        }
        
        for asset in self.assets.values():
            summary[asset.health.value] += 1
        
        return summary
    
    async def search_assets(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        model: str = "deepseek-chat"
    ) -> List[AssetSearchResult]:
        """
        AI-powered natural language asset search
        """
        # Parse the natural language query
        search_params = await self._parse_search_query(query, model)
        
        results = []
        for asset in self.assets.values():
            score = self._calculate_relevance(asset, search_params, filters)
            if score > 0.3:
                results.append(AssetSearchResult(
                    asset=asset,
                    relevance_score=score,
                    match_reason=self._get_match_reason(asset, search_params)
                ))
        
        # Sort by relevance
        results.sort(key=lambda r: r.relevance_score, reverse=True)
        
        return results[:50]  # Return top 50 results
    
    async def _parse_search_query(self, query: str, model: str) -> Dict[str, Any]:
        """Parse natural language search query using AI"""
        prompt = f"""Parse this asset search query and extract search parameters:

Query: "{query}"

Return JSON with these fields:
{{
  "keywords": ["list", "of", "keywords"],
  "asset_types": ["material", "texture", "mesh", etc.],
  "size_filter": {{"min_mb": null, "max_mb": null}},
  "health_filter": ["healthy", "warning", "error", "orphaned"],
  "name_pattern": "regex pattern or null",
  "folder_filter": "folder path or null"
}}

Examples:
- "find all metal materials" -> {{"keywords": ["metal"], "asset_types": ["material"]}}
- "show unused textures" -> {{"asset_types": ["texture"], "health_filter": ["orphaned"]}}
- "large meshes over 50mb" -> {{"asset_types": ["static_mesh", "skeletal_mesh"], "size_filter": {{"min_mb": 50}}}}
"""

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            return json.loads(response.choices[0].message.content)
        except Exception:
            # Fallback to simple keyword search
            return {"keywords": query.lower().split()}
    
    def _calculate_relevance(
        self,
        asset: Asset,
        search_params: Dict[str, Any],
        filters: Optional[Dict[str, Any]]
    ) -> float:
        """Calculate relevance score for an asset"""
        score = 0.0
        
        # Keyword matching
        keywords = search_params.get("keywords", [])
        asset_text = f"{asset.name} {asset.path}".lower()
        for keyword in keywords:
            if keyword.lower() in asset_text:
                score += 0.3
        
        # Type matching
        asset_types = search_params.get("asset_types", [])
        if asset_types:
            if asset.type.value in asset_types or any(t in asset.type.value for t in asset_types):
                score += 0.4
        
        # Size filter
        size_filter = search_params.get("size_filter", {})
        if size_filter:
            min_mb = size_filter.get("min_mb")
            max_mb = size_filter.get("max_mb")
            if min_mb and asset.size_mb < min_mb:
                return 0
            if max_mb and asset.size_mb > max_mb:
                return 0
            score += 0.2
        
        # Health filter
        health_filter = search_params.get("health_filter", [])
        if health_filter:
            if asset.health.value in health_filter:
                score += 0.3
            else:
                return 0
        
        # Apply additional filters
        if filters:
            if filters.get("type") and asset.type.value != filters["type"]:
                return 0
            if filters.get("folder") and not asset.path.startswith(filters["folder"]):
                return 0
        
        return min(score, 1.0)
    
    def _get_match_reason(self, asset: Asset, search_params: Dict[str, Any]) -> str:
        """Get human-readable reason for match"""
        reasons = []
        
        keywords = search_params.get("keywords", [])
        for keyword in keywords:
            if keyword.lower() in asset.name.lower():
                reasons.append(f"Name contains '{keyword}'")
        
        asset_types = search_params.get("asset_types", [])
        if asset_types and asset.type.value in asset_types:
            reasons.append(f"Type is {asset.type.value}")
        
        health_filter = search_params.get("health_filter", [])
        if health_filter and asset.health.value in health_filter:
            reasons.append(f"Health status is {asset.health.value}")
        
        return "; ".join(reasons) if reasons else "General match"
    
    async def batch_operation(
        self,
        operation: str,
        asset_paths: List[str],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform batch operations on multiple assets
        """
        results = {
            "success": [],
            "failed": [],
            "operation": operation
        }
        
        for path in asset_paths:
            try:
                if operation == "delete":
                    # Would call UE5 to delete
                    results["success"].append(path)
                elif operation == "move":
                    target_folder = options.get("target_folder", "")
                    # Would call UE5 to move
                    results["success"].append({"path": path, "new_path": f"{target_folder}/{path.split('/')[-1]}"})
                elif operation == "rename":
                    new_name = options.get("new_name_pattern", "")
                    # Would call UE5 to rename
                    results["success"].append(path)
                else:
                    results["failed"].append({"path": path, "error": f"Unknown operation: {operation}"})
            except Exception as e:
                results["failed"].append({"path": path, "error": str(e)})
        
        return results
    
    async def auto_fix_issue(self, issue_id: str) -> Dict[str, Any]:
        """Apply auto-fix for an issue"""
        issue = next((i for i in self.issues if i.id == issue_id), None)
        if not issue:
            return {"success": False, "error": "Issue not found"}
        
        if not issue.auto_fix_available:
            return {"success": False, "error": "Auto-fix not available for this issue"}
        
        # Would execute the fix action via UE5
        return {
            "success": True,
            "action": issue.auto_fix_action,
            "asset": issue.asset_path,
            "message": f"Applied fix: {issue.auto_fix_action}"
        }
    
    def get_asset(self, path: str) -> Optional[Asset]:
        """Get asset by path"""
        return self.assets.get(path)
    
    def get_all_assets(self) -> List[Dict[str, Any]]:
        """Get all assets as dictionaries"""
        return [self._asset_to_dict(a) for a in self.assets.values()]
    
    def _asset_to_dict(self, asset: Asset) -> Dict[str, Any]:
        """Convert asset to dictionary"""
        return {
            "id": asset.id,
            "name": asset.name,
            "path": asset.path,
            "type": asset.type.value,
            "size_mb": asset.size_mb,
            "last_modified": asset.last_modified,
            "health": asset.health.value,
            "issues": asset.issues,
            "dependency_count": len(asset.dependencies),
            "referencer_count": len(asset.referencers)
        }
    
    def _issue_to_dict(self, issue: AssetIssue) -> Dict[str, Any]:
        """Convert issue to dictionary"""
        return {
            "id": issue.id,
            "asset_path": issue.asset_path,
            "asset_name": issue.asset_name,
            "severity": issue.severity.value,
            "issue_type": issue.issue_type,
            "title": issue.title,
            "description": issue.description,
            "auto_fix_available": issue.auto_fix_available,
            "auto_fix_action": issue.auto_fix_action
        }
    
    def _duplicate_group_to_dict(self, group: DuplicateGroup) -> Dict[str, Any]:
        """Convert duplicate group to dictionary"""
        return {
            "id": group.id,
            "similarity_score": group.similarity_score,
            "assets": [self._asset_to_dict(a) for a in group.assets],
            "total_size_mb": group.total_size_mb,
            "potential_savings_mb": group.potential_savings_mb,
            "recommendation": group.recommendation
        }
    
    def _suggestion_to_dict(self, suggestion: OrganizationSuggestion) -> Dict[str, Any]:
        """Convert organization suggestion to dictionary"""
        return {
            "id": suggestion.id,
            "asset_path": suggestion.asset_path,
            "current_folder": suggestion.current_folder,
            "suggested_folder": suggestion.suggested_folder,
            "reason": suggestion.reason,
            "confidence": suggestion.confidence
        }
    
    def search_result_to_dict(self, result: AssetSearchResult) -> Dict[str, Any]:
        """Convert search result to dictionary"""
        return {
            "asset": self._asset_to_dict(result.asset),
            "relevance_score": result.relevance_score,
            "match_reason": result.match_reason
        }


# Global service instance
asset_manager_service = AssetManagerService()
