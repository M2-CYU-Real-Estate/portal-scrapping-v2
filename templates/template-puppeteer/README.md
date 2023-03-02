# [TEMPLATE] scrapping

An application for scrapping with a NodeJS application using Puppeteer.

## Usage

First, you need to have NPM and NodeJS installed. On Linux distributions with apt, you can use:

```shell
sudo apt install npm nodejs
```

Using yarn on top of NPM is recommended, as this is faster than NPM. So, after installing NPM :

```shell
npm install --global yarn
```

Now, you can easily download dependencies of the project using :

```shell
npm install
# OR
yarn install
```

If installation is successful, you can use node to run the app :

```shell
node ./ [OPTIONS]
```

## Arguments

For now, the application needs only one argument : the output folder path.

A typical example of usage will be :

```shell
node ./ --output path/to/output
```

Here is the argument list :

| Argument | Alias | Description | Required |
|----------|-------|-------------|----------|
| --output | -o | The output folder for the process | True |

This will create one folder per brand and family of cars.
