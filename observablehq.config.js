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
  footer: `<strong>Resources</strong><br>
  <a href="/how-to-use" target="_blank">How to use this map</a><br>
  <a href="/faq" target="_blank">FAQ</a>: details about the map and state bacteria objectives.<br>
  <a href="/workflow-guide" target="_blank">Development workflow guide</a>: details about data sources, processing, and display.<br><br>
  <a href="https://www.waterboards.ca.gov/" target="_blank">California State Water Resources Control Board</a><br>
  <a href="https://mywaterquality.ca.gov/" target="_blank">California Water Quality Monitoring Council</a><br>`,
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
