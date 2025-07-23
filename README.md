# Safe To Swim Map

This is a dashboard that provides real-time information on water quality at various coastal and inland beaches in the state of California. It is designed to help users make informed decisions about swimming safety based on the latest water quality data, based on the most recent risk assessment policy using bacteria data from the California State Water Resources Control Board (SWRCB).

## Features

- **Real-time Data**: Displays the latest water quality data for each site.
- **Risk Assessment**: Provides a risk assessment based on bacteria levels, indicating whether there is an elevated risk of gastro-intestinal illness from water contact.
- **Interactive Map**: Users can view the locations of sampling sites on a map and click for a risk history of each site.
- **Data Access**: Users can download data used in the dashboard for further analysis.
- **User-Friendly Interface**: Designed for easy navigation and quick access to information.

## Maintenance

### Updating layout and styles

This dashboard was built as a static site using Observable Framework. After making edits to source code (JavaScript, HTML, CSS), the site can be rebuilt by running `npm run build` in the terminal. The built files will be placed in the `dist` directory and are deployed to the `gh-pages` branch of the repository during development.

### Updating data

Data is fetched from *Surface Water - Indicator Bacteria Results* dataset on the California Open Data Portal. This dataset is updated daily, and the dashboard fetches the latest data automatically. 

## Contributing

If you would like to contribute to this project, please fork the repository and submit a pull request. We welcome contributions that improve the functionality, usability, or design of the dashboard. Because the public site is hosted by the SWRCB, please note that changes to the public site will be reviewed and may take some time to be reflected on the live site. The development version of the dashboard is available as a GitHub Pages site.