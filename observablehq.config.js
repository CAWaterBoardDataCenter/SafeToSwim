// See https://observablehq.com/framework/config for documentation.
export default {
  // The app's title; used in the sidebar and webpage titles.
  title: "Safe To Swim Map",
  head: `
    <link rel="icon" href="assets/favicon.ico" sizes="any">
    <link rel="stylesheet" href="https://unpkg.com/leaflet.fullscreen@4.0.0/Control.FullScreen.css">
  `,
  // The pages and sections in the sidebar. If you don't specify this option,
  // all pages will be listed in alphabetical order. Listing pages explicitly
  // lets you organize them into sections and have unlisted pages.
  pages: [
    {name: "Back to Map", path: "/index"},
    {name: "How to Use", path: "/how-to-use"},
    {name: "FAQ", path: "/faq"}
  ],
  // The path to the source root.
  root: "src",
  // style sheet
  style: "style.css",
  // header: "", // what to show in the header (HTML)
  footer: `<strong>Resources</strong><br><br>
  <a href="/how-to-use" target="_blank">How to use this map</a><br>
  <a href="/faq" target="_blank">FAQ</a><br>
  <a href="/development-guide" target="_blank">Development guide</a><br><br>
  <a href="https://www.waterboards.ca.gov/" target="_blank">California State Water Resources Control Board</a><br>
  <a href="https://mywaterquality.ca.gov/" target="_blank">California Water Quality Monitoring Council</a><br><br>
  Contact <a href="mailto:swamp@waterboards.ca.gov" target="_blank">swamp@waterboards.ca.gov</a> for questions and feedback<br><br>

  <strong>Disclaimer</strong>

  The data shown on this map is collected from various sources and may not be up-to-date or accurate.
  This map is intended for informational purposes only and should not be used as the sole basis for making decisions about 
  water contact activities. Always follow local advisories and guidelines when engaging in recreational activities in natural 
  water bodies. The data can change at any time and should not be used for any particular purpose other than general reference.

  In addition, the safety statuses we provide are approximations of how official state bacteria objectives are applied 
  (<a href="https://www.waterboards.ca.gov/bacterialobjectives/" target="_blank">check here for current details</a>); we do not
  recommend using these statuses directly for regulatory or legal purposes. Assessments of water quality for regulatory purposes
  should be conducted on a case-by-case basis by up-to-date standards from the original data, which is available for download on 
  the <a href="https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results" target="_blank">California Open Data Portal</a>.
`,
  sidebar: true, // enable the sidebar
  // toc: true, // whether to show the table of contents
  pager: false, // whether to show previous & next links in the footer
  output: "dist", // path to the output root for build
  // search: true, // activate search
  linkify: true, // convert URLs in Markdown to links
  // typographer: false, // smart quotes and other typographic improvements
  // preserveExtension: false, // drop .html from URLs
  // preserveIndex: false, // drop /index from URLs
};
