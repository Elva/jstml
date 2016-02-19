# jstml
Javascript template pre-compiler with namespacing support.

### install
```bash
npm install -g jstml
```

### usage
```bash
jstml --dir=src/templates --namespace=MyApp.templates > templates.js
```
```
/src
    /templates
        /layouts
            admin.jstml
            main.jstml
        _list-item.jstml
        home.jstml
        posts.jstml
```
Above folder structure will output a .js file like this:
```js
MyApp.templates = MyApp.templates || {};
MyApp.templates.layouts = MyApp.templates.layouts || {};
MyApp.templates.layouts.admin = function admin (data) {
    // template content here.
};

MyApp.templates = MyApp.templates || {};
MyApp.templates.layouts = MyApp.templates.layouts || {};
MyApp.templates.layouts.main = function main (data) {
    // template content here.
};

MyApp.templates = MyApp.templates || {};
MyApp.templates.layouts._listItem = function _listItem (data) {
    // template content here.
};

MyApp.templates = MyApp.templates || {};
MyApp.templates.layouts.home = function home (data) {
    // template content here.
};

MyApp.templates = MyApp.templates || {};
MyApp.templates.layouts.posts = function posts (data) {
    // template content here.
};
```

### defaults
```
--dir=.
--namespace=APP.TEMPLATE
```
