# Safe To Swim Map

This is a dashboard that provides real-time information on water quality at various coastal and inland beaches in the state of California. It is designed to help users make informed decisions about swimming safety based on the latest water quality data, based on the most recent risk assessment policy using bacteria data from the California State Water Resources Control Board (SWRCB).

- **Real-time Data**: Displays the water quality data for each station, updated daily.
- **Risk Assessment**: Provides a safety status based on bacteria levels, indicating whether there is an elevated risk of gastrointestinal illness from water contact.
- **Interactive Map**: Users can view the locations of sampling stations on a map and click for a risk history of each station.
- **Data Discovery and Access**: Users can explore data in the dashboard before downloading source data for further analysis.
- **User-Friendly Interface**: Designed for easy navigation and quick access to information.

## Data Sources

Data is sourced from the [California Open Data Portal](https://data.ca.gov/), specifically the [Surface Water - Indicator Bacteria Results](https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results) dataset. This dataset is updated daily and provides composited information on water quality at various sampling sites across California.

## About this Site

This dashboard was built using the open-source static site generator Observable Framework. Data is fetched from *Surface Water - Indicator Bacteria Results* dataset on the California Open Data Portal. This dataset is updated daily, and the dashboard fetches the latest data automatically.

## Contributing

This dashboard is open for continual improvement by SWRCB staff. Public feedback can be directed to swamp@waterboards.ca.gov. Because the public site is hosted by the SWRCB, please note that changes to the public site may take some time to be reflected on the live site. The development version of the dashboard is available as a GitHub Pages site.
