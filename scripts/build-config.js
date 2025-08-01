// scripts/build-config.js
import fs from "fs";
import yaml from "js-yaml";
import * as d3 from "d3-dsv";
import path from "path";

const dir = "src/data";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// --- Convert YAML to JSON ---
const yamlFile = "criteria.yml";
const criteria = yaml.load(fs.readFileSync(yamlFile, "utf8"));
fs.writeFileSync(path.join(dir, "criteria.json"), JSON.stringify(criteria, null, 2));

// --- Convert CSV to JSON ---
const csvFile = "data_cache/site_saltwater_flags.csv";
const csvText = fs.readFileSync(csvFile, "utf8");
const csvData = d3.csvParse(csvText);
fs.writeFileSync("src/data/site_saltwater_flags.json", JSON.stringify(csvData, null, 2));

console.log("✓ Config and saltwater flags converted to JSON");
