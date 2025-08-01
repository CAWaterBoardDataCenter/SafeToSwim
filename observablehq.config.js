// See https://observablehq.com/framework/config for documentation.
export default {
  // The app's title; used in the sidebar and webpage titles.
  title: "Safe To Swim Map",

  // The pages and sections in the sidebar. If you don't specify this option,
  // all pages will be listed in alphabetical order. Listing pages explicitly
  // lets you organize them into sections and have unlisted pages.
  pages: [
    {name: "Map Home", path: "/index"},
    {name: "Extended Information", path: "/extended-information"}
  ],
  // The path to the source root.
  root: "src",
  // style sheet
  style: "style.css",
  // header: "", // what to show in the header (HTML)
  footer: `See <a href="/extended-information" target="_blank">extended information</a> about the map and state bacteria objectives.`,
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
