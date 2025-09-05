"""
Create Saltwater Classification Flags

This script classifies water quality monitoring sites as either saltwater or freshwater
based on their geographic location relative to saline wetlands, saline lakes, and 
marine coastal areas in California.

The script:
1. Downloads and processes saline wetlands data from CDFW
2. Processes saline lakes data (requires manual download)
3. Downloads and processes marine coastal polygons
4. Fetches water quality monitoring sites from CA Open Data Portal
5. Classifies each site as saltwater (True) or freshwater (False)
6. Outputs results to a CSV file

Date: July 29, 2025
"""

import geopandas as gpd
import pandas as pd
import requests
import os
import zipfile
from datetime import datetime


def setup_cache_directory(cache_dir="data_cache"):
    """Create cache directory if it doesn't exist."""
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir


def fetch_or_cache(url, local_path):
    """
    Fetch data from URL or use cached copy if download fails.
    
    Args:
        url (str): URL to fetch data from
        local_path (str): Local path to save/cache the file
        
    Raises:
        FileNotFoundError: If download fails and no cached copy exists
    """
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(r.content)
        print(f"Fetched {url}")
    except Exception as e:
        print(f"Warning: could not fetch {url}, using cached copy. ({e})")
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"No cached copy for {url}")


def load_saline_wetlands(cache_dir):
    """
    Load saline wetlands data from CDFW.
    
    Args:
        cache_dir (str): Cache directory path
        
    Returns:
        gpd.GeoDataFrame: Saline wetlands polygons in EPSG:4326
    """
    print("Loading saline wetlands data...")
    saline_wetland_url = ("https://data-cdfw.opendata.arcgis.com/api/download/v1/"
                         "items/86f3f1edf91d44be9a8f237a0afde994/geojson?layers=0")
    wetlands_path = os.path.join(cache_dir, "saline_wetlands.geojson")
    
    fetch_or_cache(saline_wetland_url, wetlands_path)
    wetlands = gpd.read_file(wetlands_path).to_crs("EPSG:4326")
    
    print(f"Loaded {len(wetlands)} saline wetland polygons")
    return wetlands


def load_saline_lakes(cache_dir):
    """
    Load saline lakes data from extracted shapefile.
    
    Note: Requires manual download of SalineLakeEcosy.zip from:
    https://www.sciencebase.gov/catalog/item/667f1a25d34e2cb7853eaf4f
    
    Args:
        cache_dir (str): Cache directory path
        
    Returns:
        gpd.GeoDataFrame: Saline lake polygons in EPSG:4326
        
    Raises:
        FileNotFoundError: If zip file not found and directory not extracted
    """
    print("Loading saline lakes data...")
    lake_zip_path = os.path.join(cache_dir, "SalineLakeEcosy.zip")
    print(f"Expected zip file at: {lake_zip_path}")
    lakes_dir = os.path.join(cache_dir, "SalineLakeBnd")
    lakes_path = os.path.join(lakes_dir, "SalineLakeBnd.shp")

    if not os.path.exists(lakes_dir):
        if not os.path.exists(lake_zip_path):
            raise FileNotFoundError(
                "Please manually download SalineLakeEcosy.zip to data_cache/ and rerun"
            )
        print("Extracting Saline Lake zip...")
        with zipfile.ZipFile(lake_zip_path, 'r') as zip_ref:
            zip_ref.extractall(cache_dir)
    else:
        print("Using existing extracted SalineLakeBnd directory")

    lakes = gpd.read_file(lakes_path).to_crs("EPSG:4326")
    print(f"Loaded {len(lakes)} saline lake polygons")
    return lakes


def load_marine_coastal_areas(buffer_degrees=0.01):
    """
    Load and process marine coastal areas from CA Nature data.
    
    Args:
        buffer_degrees (float): Buffer distance in degrees to apply to marine areas
        
    Returns:
        gpd.GeoDataFrame: Buffered marine coastal areas in EPSG:4326
    """
    print("Loading marine coastal areas...")
    url = (
        "https://services8.arcgis.com/JFYbogndXme7ddg8/arcgis/rest/services/"
        "CA_Nature_Terrestrial_and_Marine__AGOL__WebMer_/FeatureServer/0/query"
        "?where=1=1&outFields=*&outSR=4326&f=json"
    )
    
    coastal = gpd.read_file(url)
    
    # Filter only marine polygons
    marine = coastal[coastal["TerrMar"].str.lower() == "marine"]
    print(f"Found {len(marine)} marine polygons")
    
    # Apply buffer and union
    marine_union = marine.geometry.union_all()
    marine_buffered = marine_union.buffer(buffer_degrees)
    
    # Wrap in GeoDataFrame
    marine_buffered_gdf = gpd.GeoDataFrame(geometry=[marine_buffered], crs="EPSG:4326")
    print(f"Applied {buffer_degrees} degree buffer to marine areas")
    
    return marine_buffered_gdf


def fetch_ckan_all(resource_id, fields=None):
    """
    Fetch all records from a CKAN resource, handling pagination.
    
    Args:
        resource_id (str): CKAN resource ID
        fields (str, optional): Comma-separated field names to retrieve
        
    Returns:
        pd.DataFrame: All records from the resource
    """
    base_url = "https://data.ca.gov/api/3/action/datastore_search"
    offset = 0
    limit = 50000
    dfs = []
    
    while True:
        params = {"resource_id": resource_id, "limit": limit, "offset": offset}
        if fields:
            params["fields"] = fields
            
        r = requests.get(base_url, params=params)
        r.raise_for_status()
        result = r.json()["result"]
        records = result["records"]
        dfs.append(pd.DataFrame(records))
        
        offset += limit
        if offset >= result["total"]:
            break
            
    return pd.concat(dfs, ignore_index=True)


def load_monitoring_sites():
    """
    Load water quality monitoring sites from CA Open Data.
    
    Returns:
        gpd.GeoDataFrame: Monitoring sites with geometry in EPSG:4326
    """
    print("Loading monitoring sites from CA Open Data...")
    
    # Resource IDs for different water quality datasets
    resource_ids = [
        "1d333989-559a-433f-b93f-bb43d21da2b9",
        "04d98c22-5523-4cc1-86e7-3a6abf40bb60", 
        "15a63495-8d9f-4a49-b43a-3092ef3106b9"
    ]
    
    # Fetch site data from all resources
    sites = pd.concat([
        fetch_ckan_all(rid, "StationCode,TargetLatitude,TargetLongitude") 
        for rid in resource_ids
    ], ignore_index=True)
    
    # Remove duplicates
    sites = sites.drop_duplicates()
    print(f"Loaded {sites['StationCode'].nunique()} unique monitoring stations")
    
    # Create GeoDataFrame
    gdf_sites = gpd.GeoDataFrame(
        sites,
        geometry=gpd.points_from_xy(sites.TargetLongitude, sites.TargetLatitude),
        crs="EPSG:4326"
    )
    
    # Remove sites with invalid coordinates
    gdf_sites = gdf_sites.dropna(subset=["geometry"])
    print(f"Sites with valid coordinates: {len(gdf_sites)}")
    
    return gdf_sites


def classify_sites(gdf_sites, saltwater_polygons):
    """
    Classify monitoring sites as saltwater or freshwater.
    
    Args:
        gdf_sites (gpd.GeoDataFrame): Monitoring sites
        saltwater_polygons (gpd.GeoDataFrame): Combined saltwater polygons
        
    Returns:
        gpd.GeoDataFrame: Sites with saltwater classification flag
    """
    print("Classifying sites as saltwater or freshwater...")
    
    # Union all saltwater geometries
    saltwater_union = saltwater_polygons.geometry.union_all()
    print(f"Saltwater union geometry type: {saltwater_union.geom_type}")
    
    # Classify each site: True = saltwater, False = freshwater
    gdf_sites["saltwater"] = gdf_sites.geometry.within(saltwater_union)
    
    saltwater_count = gdf_sites["saltwater"].sum()
    freshwater_count = (~gdf_sites["saltwater"]).sum()
    
    print(f"Classification complete:")
    print(f"  Saltwater sites: {saltwater_count}")
    print(f"  Freshwater sites: {freshwater_count}")
    print(f"  Total sites: {len(gdf_sites)}")
    
    return gdf_sites


def save_results(gdf_sites, cache_dir, output_name="site_saltwater_flags.csv"):
    """
    Save classification results to CSV file.
    
    Args:
        gdf_sites (gpd.GeoDataFrame): Classified sites
        output_name (str): Output file name
    """
    # Ensure output directory exists
    output_path = os.path.join(cache_dir, output_name)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save only station code and classification flag
    gdf_sites[["StationCode", "saltwater"]].to_csv(output_path, index=False)
    print(f"Classification results saved to {output_path}")


def main():
    """Main execution function."""
    print("Starting saltwater classification process...")
    print(f"Timestamp: {datetime.now()}")
    
    # Setup
    cache_dir = setup_cache_directory()
    
    # Load saltwater polygon data sources
    wetlands = load_saline_wetlands(cache_dir)
    lakes = load_saline_lakes(cache_dir)
    marine_areas = load_marine_coastal_areas(buffer_degrees=0.01)
    
    # Combine all saltwater polygons
    print("Combining saltwater polygon sources...")
    saltwater_polygons = gpd.GeoDataFrame(
        pd.concat([wetlands, lakes, marine_areas], ignore_index=True),
        crs="EPSG:4326"
    )
    print(f"Total saltwater polygons: {len(saltwater_polygons)}")
    
    # Load and classify monitoring sites
    gdf_sites = load_monitoring_sites()
    gdf_sites = classify_sites(gdf_sites, saltwater_polygons)
    
    # Save results
    save_results(gdf_sites, cache_dir)
    
    print("Saltwater classification process completed successfully!")


if __name__ == "__main__":
    main()
