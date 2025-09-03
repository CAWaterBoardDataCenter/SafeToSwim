---
toc: true
---

# Development Guide

This document details the dataflow used in the Safe to Swim Map, including data sources, processing steps, and deployment procedures. The goal is to provide clear documentation for contributors to understand and maintain the dashboard. The workflow guide should be continually updated to reflect changes to the dashboard.

---

## DATA FLOW OVERVIEW

---

## Source datasets to compiled dataset

The Safe to Swim Map relies on various data sources to provide accurate and up-to-date information about water quality. These sources include:

- California Environmental Data Exchange Network (CEDEN)
- BeachWatch database
- Lower American River E. coli Monitoring Results interactive map

These data are filtered, transformed, and compiled into a database in the California Open Data Portal called [Surface Water - Indicator Bacteria Results](https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results) that the dashboard queries to display information. More details about the processing at this stage are provided at (TODO).

### Ancillary datasets

In addition to the main water quality datasets, a few ancillary datasets are critical the functionality of the dashboard by providing a freshwater vs saltwater classification for each station. We assume that all water bodies are freshwater unless they are specifically identified as saltwater. The saltwater bodies we account for are:

- Saline lakes: These are lakes with a high concentration of saltwater, typically found in coastal areas or regions with high evaporation rates. Source: [U.S. Department of the Interior](https://catalog.data.gov/dataset/saline-lake-ecosystems-iwaa-lakes)
- Saline wetlands: These are wetlands that are influenced by saltwater, often found in coastal regions or areas with tidal fluctuations. Source: [California Department of Fish and Wildlife](https://data.ca.gov/dataset/saline-wetlands-ace-ds28641)
- Coastlines: These are areas where land meets the ocean. Source: [California Natural Resources Agency](https://data.ca.gov/dataset/terrestrial-and-marine-reference)

While the wetlands and coastline data can be programmatically downloaded, the saline lakes dataset must be manually downloaded as a zip file to where `create_saltwater_flags.py` can read it.

## Dashboard data processing

Water quality data is fetched fresh from the compiled dataset each time a user loads the site. The data is processed on the client/browser side using a combination of Python and JavaScript, depending on the specific task. The main processing tasks include:

- **Getting recent station data for the map**: This involves querying the compiled dataset for the most recent water quality data at each monitoring station, with just enough information to display on the map and include status logic.
- **Getting all historical data for a selected station**: When a user selects a station on the map, additional data is queried from the compiled dataset to show historical water quality trends for that specific location.
- **Determining saltwater vs freshwater stations**: A Python script (`create_saltwater_flags.py`) is used to classify each station as either saltwater or freshwater based on its geographic location and other criteria. This classification is important for applying the correct water quality standards. Note that this script is run on build as a pre-build script, and the results are saved to a csv file (`site_saltwater_flags.csv`). This is converted to a json file (`saltwater_flags.json`) that the dashboard can load.
- **Applying status logic**: The dashboard uses predefined thresholds to determine the safety status of each station based on the most recent water quality data. This logic is applied both when loading the map (current status) and when viewing detailed station information (historical status).
- **Preparing data for visualization**: Specific visualizations require additional data processing steps, such as calculating time windows or summary statistics.

### Status evaluation, detail

Safety statuses are based on the results of water quality testing and comparison to established thresholds. By the most recent [California bacteria objectives](https://www.waterboards.ca.gov/bacterialobjectives/), a station has a "Use caution" status if *either* of the following are true:

1. More than 10% of single samples in the last 30 days exceed the single-sample threshold.
2. The 6-week rolling geometric mean exceeds the geometric mean threshold. The rolling window includes samples from the past 6 weeks, including the most recent sample.

A station is considered "Low risk" if *both* the single sample and 6-week geometric mean are below their respective thresholds. If there are fewer than 5 samples in the past 6 weeks, the station will have a "Not enough data" status.

Statuses are shown in two places in the dashboard code: for the map (current day-of status only) and for the detailed station view (historical status). The logic is implemented in `status.js`. Status is evaluated n a daily grid (i.e. for each day) spanning the first sample date to the current date. For a given station and day, metrics for bacteria data (E. coli for freshwater sites and enterococcus for saltwater sites) from the last 6 weeks are computed: the proportion of single samples from the last 30 days exceeding the single-sample threshold and the 6-week geomean. The single-sample metric uses a binned approximation of the 90th percentile for speed.

Since computing a daily history is expensive, the status history computation is optimized by only re-evaluating status when the data within a time window changes. For example, if 6 weeks ago to today contains the same sample data as 6 weeks from tomorrow to tomorrow, status only needs to be evaluated once for both today and tomorrow.

## Site deployment

The Safe to Swim Map is a static site generated using [Observable Framework](https://observablehq.com/framework/). Observable Framework uses a reactive programming model to enable dynamic data visualizations, using markdown, customizable html/JavaScript/data loaders. The static site generator creates content that can be served from anywhere. The official site is hosted by the State Water Board web team. A staging version of the site is also hosted as a GitHub Pages site from the `dist/` directory of this repository. Changes made to the site should be tested first at the staging level before being deployed to the official site.

To maintain the Safe to Swim Map, contributors should follow these deployment procedures:

1. **Code Updates**: Make necessary code changes in a separate branch.
2. **Testing**: Thoroughly test changes to ensure they do not introduce new issues.
3. **Test Deployment**: Once approved, changes are deployed to GitHub Pages for staging.
4. **Final Deployment**: After successful testing on the staging site, coordinate with the State Water Board web team to deploy changes to the official site.

---

## DEVELOPMENT

---

### Project structure

The Safe to Swim Map dashboard is organized into several key directories and files to facilitate development, data management, and deployment. Below is an overview of the file structure:

```
safe-to-swim/
│├── src/                   # Source code for the dashboard
│   ├── index.md            # Main dashboard page
│   ├── faq.md              # Frequently Asked Questions page
│   ├── how-to-use.md       # How to Use page
│   ├── workflow-guide.md   # This workflow guide page
│   ├── style.css           # CSS for styling the dashboard
│   ├── station-state.js    # JavaScript logic for selecting stations in the dashboard
│   ├── modules.js          # Utility functions and helpers
│   ├── data/               # Data files generated or used by the dashboard
│   └── assets/             # Images and other static assets
│├── dist/                  # Distribution files for deployment
│   └── (generated files)   # Compiled and minified files for production
│├── scripts/               # Scripts for data processing and site generation
│   ├── create_saltwater_flags.py       # Script to create saltwater flags
│   └── build-config.js     # Script to build the site
│├── requirements.txt      # Python dependencies for create_saltwater_flags.py
│├── criteria.yml           # YAML file defining status thresholds and metadata
│├── observablehq.config.js # Configuration for Observable site generation
│├── package.json           # Node.js project configuration
│├── README.md              # Project overview and setup instructions
│├── .gitignore             # Git ignore file
│├── .github/               # GitHub configuration files
│   ├── workflows/deploy.yml  # GitHub Actions workflow for GitHub Pages deployment
```

Each directory and file serves a specific purpose in the development and maintenance of the Safe to Swim Map dashboard. Contributors should familiarize themselves with this structure to effectively navigate and contribute to the project.

### Build vs runtime code

It is useful to distinguish between files that are part of the site content (e.g., markdown files in `src/`) and files that are part of the data processing or site generation workflow (e.g., scripts in `scripts/`). In other words, some pieces of code are only run when the site is built, while other pieces of code are run in the browser when a user visits the site.

## Status logic

The status logic used to determine the safety status of each station is defined in the `criteria.yml` file (another file, `criteria.json` is automatically generated from the YAML file—do not modify this file as it will be overwritten by the old criteria on build). This file contains threshold values for different indicator bacteria types, as well as metadata such as status descriptions and colors. The status logic is applied in the dashboard code when processing water quality data. Some aspects of criteria.yml can be modified, such as the values of existing thresholds, without needing to modify the dashboard code itself. However, more substantial changes to the status logic (e.g., adding new statistics, changing indicator bacteria types) may require updates to the dashboard code in addition to a site rebuild.

Currently, the status logic requires each station to be classified as either saltwater or freshwater, as the thresholds differ between these two types of water bodies. The saltwater vs freshwater classification is determined using the `create_saltwater_flags.py` script, which is run when the site is built. The results are saved to a json file (`saltwater_flags.json`) that the dashboard can load. Changes to the saltwater vs freshwater classification (e.g., adding new saltwater bodies) will require running this script and rebuilding the site.

## Dashboard interactivity

The Safe to Swim Map dashboard is designed to be interactive and user-friendly. Users can explore the map, search for specific stations, and view detailed information about water quality at each location. Interactivity is primarily handled through JavaScript code in the `station-state.js` and `modules.js` files (as well as some JavaScript in the markdown files, but for code readability most logic is kept in the JS files). Key interactive features include:

- **Map Interaction**: Users can click on station markers to view detailed information, including current status and historical data.
- **Search Functionality**: A search bar allows users to quickly find stations by name or code.
- **Dynamic Data Loading**: Data is fetched and processed in real-time as users interact with the dashboard.

### Station selection

One potentially sensitive aspect of interactivity is the handling of station selection and state management. The `station-state.js` file manages the current state of the selected station, ensuring that the correct data is displayed when a user interacts with the map or search bar. The station that is currently selected is stored as a reactive variable `selectedStation`, which is updated whenever a user clicks on a station marker or selects a station from the search results. This variable is then used to fetch and display the relevant data for the selected station. `selectedStation`, initialized to `null`, is updated via the `setSelectedStation` function (in `station-state.js` as an event bus) whenever a user interacts with the map or search bar. Other parts of the dashboard listen for changes to `selectedStation` and update the displayed information accordingly.

### Plot interaction

Plots in the Data panel are created using the Observable Plot library.  We use interactive features such as tooltips that display additional information when hovering over data points. These interactions are handled through Plot's built-in functionality.

The data shown in the plots is dynamically updated based on the user-selected station, ensuring that users always see the most relevant information for the selected station. Each station's plots default to showing samples of the indicator bacteria used for that station environment (e.g. a saltwater station will show data for enterococcus by default). Additionally, the user can control the extent of the time domain displayed.

## Building the site

Building the site means generating the static files that will be served to users. To build the site, run the following command:

```
npx observable build
```

This will generate the static files in the `dist/` directory, which can then be deployed to the official site. Alternatively, for development purposes, you can simply push changes to the `main` branch of the GitHub repository, which will automatically trigger a rebuild and deployment to the staging site via GitHub Actions. Files for the official site must be manually deployed by the State Water Board web team, and can be sourced from a local build or from the staging site.

During development, it is recommended that you run:

```
npx observable preview
```

to preview the site locally. This will start a local server and open the site in your default web browser. Any changes made to the source files will automatically trigger a rebuild and refresh the browser.

### What happens during a site build

The following occur when the command `npx observable build` is run.

First, `build-config.js` is run, which converts `criteria.yml` and `site_saltwater_flags.csv` to json files that the dashboard can load. Next, the Observable Framework static site generator processes the markdown files in `src/`, along with any JavaScript and data files they reference, to generate the static files in the `dist/` directory.

Note: The `create_saltwater_flags.py` script, which produces `site_saltwater_flags.csv`, must be run manually whenever there are changes to the saltwater classification criteria or the monitoring site data. This script requires Python and the dependencies listed in `requirements.txt` to be installed.

---

## MAINTENTANCE

---

The site should be rebuilt when there are changes that affect the data processing, status logic, or site content. The only updates that do not need site rebuilds are changes to the Surface Water - Indicator Bacteria Results dataset values (e.g. if a lat/lon pair is corrected in the dataset, rows are added/deleted). Below are some examples of when a site rebuild is necessary:

### New stations added

Because the saltwater vs freshwater classification is determined by a manual run of `create_saltwater_flags.py`, new stations added to the Surface Water - Indicator Bacteria Results dataset will require a site rebuild to ensure they are correctly classified.

### Major reorganization of the Surface Water - Indicator Bacteria Results dataset

Regular additions to the dataset will automatically update what is shown on the site, but other changes may require a rebuild of the site. Here are some examples of when to rebuild the site:

- Column names change
- Columns used in the dashboard are removed
- New columns are added that should be used in the dashboard

### Updates to status logic

- Threshold values change
- New statistics are added (e.g. adding a 7-day rolling average)
- New status categories are added (e.g. a "Closure" status)
- Indicator bacteria types change (e.g. adding enterococcus for freshwater)
- Status depends on new testing methods (e.g. ddPCR)

### Updates to data flow

- Changes to how data is queried
- Improvements to how saltwater vs freshwater is determined for each station

### Updates to other site content

- Changes to text and layout in markdown files
- Changes to CSS styling
- Changes to plots or other visualizations
- Improvements to performance, user experience