"""
Create Saltwater Classification Flags

This script classifies water quality monitoring sites as either saltwater or freshwater
based on their geographic location relative to saline wetlands, saline lakes, and 
marine coastal areas in California.

The script:
1. Downloads and processes coastal wetlands
2. Processes saline lakes data (requires manual download)
3. Downloads and processes marine coastal polygons
4. Downloads and proceses bays/estuaries data
5. Fetches water quality monitoring sites from CA Open Data Portal
6. Classifies each site as saltwater (True) or freshwater (False)
7. Outputs results to a CSV file

The CSV output should be saved to the data_cache folder in root

Date: November 21, 2025
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


def load_wetlands(buffer_meters=10):
    """
    Load the saline wetlands dataset from the California Coastal Sediment Management Workgroup (CSMW). This service is hosted on the CNRA GIS server.

    CSMW link: https://dbw.parks.ca.gov/?page_id=28708
    Service link: https://gis.cnra.ca.gov/arcgis/rest/services/Ocean/CSMW_Coastal_Wetlands/MapServer
    
    Args:
        buffer_meters (float): Buffer distance in meters
        
    Returns:
        gpd.GeoDataFrame: Saline wetlands polygons in EPSG:3310
    """
    print("Loading saline wetlands data...")

    # Specify EPSG:3310 in the query
    saline_wetland_url = 'https://gis.cnra.ca.gov/arcgis/rest/services/Ocean/CSMW_Coastal_Wetlands/MapServer/0/query?where=1=1&outSR=3310&outFields=*&f=json' 

    wetlands = gpd.read_file(saline_wetland_url)
    print(f"Loaded {len(wetlands)} saline wetland polygons")

    wetlands = wetlands.explode(index_parts=False) # Convert multipolgygon to multiple single polygons
    wetlands = wetlands.buffer(buffer_meters) 
    return wetlands


def load_saline_lakes(cache_dir, buffer_meters=50):
    """
    Load and combine saline lakes data from:

    1) Saline Lake Ecosystems IWAA Lakes

    Note: Requires manual download of SalineLakeEcosy.zip from:
    https://www.sciencebase.gov/catalog/item/667f1a25d34e2cb7853eaf4f
    11/06/25 - File "SalineLakeEcosy.zip" is not available on website. Service is not working either. Using "SalineLakeBnd.zip" seems to work. This dataset does not include Salton Sea.

    2) CA Named Lakes 

    Link: https://gispublic.waterboards.ca.gov/portal/home/item.html?id=9ca35044184e48f28ae4a8586d65b8d4&sublayer=1
    This Water Boards GIS service is derived from the candidate high-resolution National Hydrography Dataset (NHD). It is being used to query the Salton Sea polygon.
    
    Args:
        cache_dir (str): Cache directory path
        buffer_meters (float): Buffer distance in meters
        
    Returns:
        gpd.GeoDataFrame: Saline lake polygons in EPSG:3310
        
    Raises:
        FileNotFoundError: If zip file not found and directory not extracted
    """
    print("Loading saline lakes data...")

    # Check for Saline Lake Ecosystems IWAA Lakes data
    lake_zip_path = os.path.join(cache_dir, "SalineLakeBnd.zip")
    print(f"Expected zip file at: {lake_zip_path}")
    lakes_dir = os.path.join(cache_dir, "SalineLakeBnd")
    lakes_path = os.path.join(lakes_dir, "SalineLakeBnd.shp")

    if not os.path.exists(lakes_dir):
        if not os.path.exists(lake_zip_path):
            raise FileNotFoundError(
                "Please manually download SalineLakeBnd.zip to data_cache/ and rerun"
            )
        print("Extracting Saline Lake zip...")
        with zipfile.ZipFile(lake_zip_path, 'r') as zip_ref:
            zip_ref.extractall(cache_dir)
    else:
        print("Using existing extracted SalineLakeBnd directory")

    # Load Saline Lake Ecosystems IWAA Lakes data
    lakes = gpd.read_file(lakes_path)
    lakes = lakes.set_crs('EPSG:5070') # Define projection as EPSG:5070 (https://www.sciencebase.gov/catalog/item/667f1a25d34e2cb7853eaf4f)
    lakes = lakes.to_crs('EPSG:3310') # Reproject to EPSG:3310
    lakes = lakes.buffer(buffer_meters)

    # Load CA Named Lakes dataset (Salton Sea polygon)
    named_lakes_url = "https://gispublic.waterboards.ca.gov/portalserver/rest/services/Hosted/All_CA_Named_Streams_and_Lakes/FeatureServer/1/query?where=name%3D%27Salton+Sea%27&outFields=*&returnGeometry=true&f=json" # Filter for Salton Sea
    salton_sea = gpd.read_file(named_lakes_url)
    salton_sea = salton_sea.set_crs('EPSG:3310') # Define projection as EPSG:3310, verified in ArcGIS
    salton_sea = salton_sea.buffer(buffer_meters) 

    # Combine all lake polygons into one gdf
    all_lakes = pd.concat([lakes, salton_sea], ignore_index=True)
    all_lakes_gdf = gpd.GeoDataFrame(geometry=all_lakes, crs='EPSG:3310')

    print(f"Loaded {len(all_lakes_gdf)} saline lake polygons")
    return all_lakes_gdf


def load_marine_coastal_areas(buffer_meters=50):
    """
    Load and process CA Cartographic Coastal Polygons from CDT?. This dataset was developed based on NOAA data. 
    Link: https://services3.arcgis.com/uknczv4rpevve42E/ArcGIS/rest/services/California_Cartographic_Coastal_Polygons/FeatureServer/31
    
    Args:
        buffer_meters (float): Buffer distance in meters
        
    Returns:
        gpd.GeoDataFrame: Buffered marine coastal areas in EPSG:4326
    """

    print("Loading marine coastal areas...")
    url = "https://services3.arcgis.com/uknczv4rpevve42E/ArcGIS/rest/services/California_Cartographic_Coastal_Polygons/FeatureServer/31/query?where=1=1&outFields=*&outSR=4326&f=json"
    coastal = gpd.read_file(url) # Imported as EPSG:4326
    coastal = coastal.to_crs('EPSG:3310') # Convert to EPSG:3310
    print(f"Found {len(coastal)} marine polygons")

    # Union and apply buffer
    marine_union = coastal.geometry.union_all()
    marine_union = marine_union.buffer(buffer_meters)
    print(f"Applied {buffer_meters} meter buffer to marine areas")
    
    # Wrap in GeoDataFrame
    marine_buffered_gdf = gpd.GeoDataFrame(geometry=[marine_union], crs="EPSG:3310")

    return marine_buffered_gdf


def load_estuaries(buffer_meters=50):
    """
    Load current and historical estuary extent data from CDFW
    Link: https://www.arcgis.com/home/item.html?id=c0b97243451f46db84b51d044424b51a
    
    Args:
        buffer_meters (float): Buffer distance in meters
        
    Returns:
        gpd.GeoDataFrame: Estuary polygons in EPSG:3310
    """
    # Filter out CMECS_Class == "Major River Delta" as these features extend too far inland to the Lower American
    url = "https://services2.arcgis.com/Uq9r85Potqm3MfRV/ArcGIS/rest/services/biosds2792_fpu/FeatureServer/0/query?where=CMECS_Class+%3C%3E+%27Major+River+Delta%27&outFields=*&returnGeometry=true&f=json"
    estuaries = gpd.read_file(url)
    estuaries = estuaries.explode(index_parts=False) # Convert multipolgygon to multiple single polygons

    estuaries = estuaries.set_crs('EPSG:3857') # Define projection as EPSG:3857 based on service page metadata
    estuaries = estuaries.to_crs('EPSG:3310') # Reproject to EPSG:3310
    print(f"Found {len(estuaries)} estuary polygons")

    # estuary_union = estuaries.geometry.union_all()
    estuary_buffer = estuaries.buffer(buffer_meters)

    # Wrap in GeoDataFrame
    estuary_gdf = gpd.GeoDataFrame(geometry=estuary_buffer, crs="EPSG:3310")

    return estuary_gdf


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

    # Convert to EPSG:3310
    gdf_sites = gdf_sites.to_crs('EPSG:3310')
    
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

    # For testing
    gdf_sites.to_file(os.path.join(cache_dir, 'gdf_sites.shp'), driver='ESRI Shapefile')
    
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
    wetlands = load_wetlands(buffer_meters=10)
    lakes = load_saline_lakes(cache_dir, buffer_meters=50)
    marine_areas = load_marine_coastal_areas(buffer_meters=80)
    estuaries = load_estuaries(buffer_meters=50)

    # For testing: Save saltwater features to file for review
    # wetlands.to_file(os.path.join(cache_dir, 'saline_wetlands.shp'), driver='ESRI Shapefile')
    # lakes.to_file(os.path.join(cache_dir, 'saline_lakes.shp'), driver='ESRI Shapefile')
    # marine_areas.to_file(os.path.join(cache_dir, 'saline_marine_areas.shp'), driver='ESRI Shapefile')
    # estuaries.to_file(os.path.join(cache_dir, 'saline_estuaries.shp'), driver='ESRI Shapefile')

    # Combine all saltwater polygons
    print("Combining saltwater polygon sources...")
    geoms = pd.concat([
        wetlands.geometry,
        lakes.geometry,
        marine_areas.geometry,
        estuaries.geometry
    ], ignore_index=True)
    saltwater_polygons = gpd.GeoDataFrame(
        geometry = geoms,
        crs="EPSG:3310"
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
