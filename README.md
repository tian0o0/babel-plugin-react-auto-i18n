## babel-plugin-react-auto-i18n

> WIP...Now it's depend on vite, in the future the vite will be removed.

### Install
```sh
npm i babel-plugin-react-auto-i18n -D
```

### Usage
```js
import reactAutoI18n from "babel-plugin-react-auto-i18n"

babel({
    plugins: [
        [
            reactAutoI18n,
            {
                include: "**/*.tsx",
                exclude: "node_modules",
                output: "./i18n"
            }
        ]
    ]
})
```

### Tip

Before use this plugin, you should ensure `react-i18next` and `i18next` has been installed.