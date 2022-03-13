# Descent-Extractor
Node JS tool to extract assets from Descent game and convert them 

1. Copy **descent.pig** and **descent.hog** files from your Descent installation into the `input/` directory.
2. Install the NPM modules:
   ```
   npm install
   ```
3. Extract assets
   ```
   node extractor.js
   ```

Extracted assets in their Raw data will be inside `output/` directory.

The converted assets into PNGs will be inside `converted/` directory.
