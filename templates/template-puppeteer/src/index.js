
const commandLineArgs = require('command-line-args');
const fs = require("fs");
const saveToJson = require('./saver');

// TODO create a class extending navigator/Navigator with a method for fetching wanted elements
// TODO import the navigator implementation

/**
 * Fetch the wanted command line arguments
 * @returns An object with argument's names as fields
 */
const parseArgs = () => {
    const optionDefitions = [
        {
            // Required
            name: "output",
            alias: "o",
            type: String
        }
    ];
    const options = commandLineArgs(optionDefitions);

    // Check if valid
    if (!options.output) {
        throw new Error('"--output" argument required');
    }
    if (!fs.existsSync(options.output)) {
        throw new Error(`Output directory does not exist : ${options.output}`);
    }
    
    return options;
};

const main = async () => {

    const args = parseArgs();
    const outputPath = args.output;

    // Mandatory, call init in order to launch the browser
    // await navigator.init();

    // TODO, call the specific method(s) for fetching data (iterable, array of jsons, whatever)

    // TODO, use outputPath to save to specific path
    // ex: saveToJson(arr, outputPath)

    // Also mandatory, we don't want the browser to stay alive after the execution
    // await navigator.close();
};

try {
    main();
} catch (err) {
    console.error("An error occured while scrapping data");
    console.error(err);
}