
const puppeteer = require('puppeteer');

/**
 * The main class to implement for browsing into websites
 */
class Navigator {
    #currentUrl;
    #page;
    #browser;

    constructor() {
        // check if try to instanciate directly this
        // if (this.constructor === Navigator) {
        // throw new Error("Cannot instanciate BaseMuniNavigator directly");
        // }
        this.#currentUrl = null;
        this.#browser = null;
        this.#page = null;
    }

    async init() {
        this.#browser = await this.#openBrowser();
        this.#page = await this.#initPage();
        return this;
    }

    // ==== INIT BROWSER ====

    async #openBrowser() {
        // Add the adblocker plugin
        
        return puppeteer.launch({
            args: ['--no-sandbox'], // useful when using docker (allow using app as admin)
            headless: false,
            ignoreHTTPSErrors: true,
        });
    }

    async #initPage() {
        const page = (await this.#browser.pages())[0];

        await page.setViewport({ width: 1366, height: 768 });

        page.on("pageerror", function (err) {
            console.log("!!! page error : " + err.toString());
        });
        page.on("error", function (err) {
            console.log("!!! main error : " + err.toString());
        });
        page.on("console", function (txt) {
            console.log("!!! CONSOLE : " + JSON.stringify(txt.text()));
        });

        await this.delay(2000);
        return page;
    }

    // ==== UTIL METHODS ====
    async delay(timeMs) {
        return new Promise(resolve => setTimeout(resolve, timeMs));
    }

    /**
     * Go to a page and wait until no requests are done during 500ms
     * @param {String} url 
     */
    async goTo(url) {
        // wait until no request done for 500 ms
        // https://blog.cloudlayer.io/puppeteer-waituntil-options/
        console.log("Go to " + url);
        await this.#page.goto(url, { waitUntil: 'networkidle0' });
        this.#currentUrl = this.#page.url();
    }

    /**
     * Go to the last page and wait until no requests are done during 500ms
     */
    async goBack() {
        await this.#page.goto(url, { waitUntil: 'networkidle0' });
        this.#currentUrl = this.#page.url();
        console.log("Gone back to " + this.#currentUrl);
    }

    async close() {
        await this.#browser.close();
    }

    get currentUrl() {
        return this.#currentUrl;
    }

    get page() {
        return this.#page;
    }
};
module.exports = Navigator;