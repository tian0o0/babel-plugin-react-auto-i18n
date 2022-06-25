// const { declare } = require("@babel/helper-plugin-utils");
import generate from "@babel/generator";
import { createFilter } from "vite";
import path from "path";
import fse from "fs-extra";

let keyIndex = 0;
let keys = [];
let filter;
function nextKey() {
  keyIndex++;
  return `key${keyIndex}`;
}

export default (api, options) => {
  api.assertVersion(7);
  if (!options.output) {
    throw new Error("output cannot be empty");
  }
  filter = createFilter(options.include);

  function getReplaceExpression(path, value) {
    const expressionParams = path.isTemplateLiteral()
      ? path.node.expressions.map((item) => generate(item).code)
      : null;
    let replaceExpression = api.template.ast(
      `t('${value}'${expressionParams ? "," + expressionParams.join(",") : ""})`
    ).expression;
    if (
      path.findParent((p) => p.isJSXAttribute()) &&
      !path.findParent((p) => p.isJSXExpressionContainer())
    ) {
      replaceExpression = api.types.JSXExpressionContainer(replaceExpression);
    }
    return replaceExpression;
  }

  function save(file, key, value) {
    const keys = file.get("keys");
    keys.push({
      key,
      value,
    });
    file.set("keys", keys);
  }

  return {
    name: "babel-plugin-react-auto-i18n",
    pre(file) {
      file.set("keys", keys);
    },
    visitor: {
      Program: {
        enter(path, state) {
          // 过滤规则
          if (!filter(state.file.opts.filename)) {
            state.ignoreFile = true;
            return;
          }
          // 忽略整个文件
          if (
            state.file.ast.comments.some((comment) =>
              comment.value.includes("i18n-ignore-file")
            )
          ) {
            state.ignoreFile = true;
          }

          // 判断是否已经导入react-i18next
          path.traverse({
            ImportDeclaration(p) {
              const source = p.node.source.value;
              if (source === "react-i18next") {
                state.imported = true;
              }
            },
          });

          // 如果未导入react-i18next
          if (!state.imported && !state.ignoreFile) {
            const importAst = api.template.ast(
              `import { useTranslation } from 'react-i18next'`
            );
            path.node.body.unshift(importAst);
          }

          path.traverse({
            // ArrowFunctionExpression(path, state) {
            //   path.findParent((p) => {
            //     console.log(p.node.type);
            //     console.log(p.isArrowFunctionExpression());
            //   });
            // },
            "StringLiteral|TemplateLiteral"(path) {
              // 如果有注释则忽略
              if (path.node.leadingComments) {
                path.node.leadingComments = path.node.leadingComments.filter(
                  (comment) => {
                    if (comment.value.includes("i18n-ignore")) {
                      path.node.skipTransform = true;
                      return false;
                    }
                    return true;
                  }
                );
              }
              if (
                path.findParent(
                  (p) =>
                    p.isImportDeclaration() ||
                    p.isCallExpression() ||
                    p.isExportAllDeclaration() ||
                    p.isJSXAttribute()
                )
              ) {
                path.node.skipTransform = true;
              }
              // isJSXAttribute ["className", "size"].includes(p.node.name.name)
            },
          });
        },
      },
      "FunctionDeclaration|ArrowFunctionExpression"(path, state) {
        if (state.imported || state.ignoreFile) return;
        const body = path.get("body");
        if (body.isBlockStatement()) {
          const useTranslation = api.template.ast(
            `const {t} = useTranslation()`
          );
          body.node.body.unshift(useTranslation);
        }
      },
      StringLiteral(path, state) {
        if (state.imported || state.ignoreFile) return;
        if (path.node.skipTransform || !path.node.loc) {
          return;
        }

        let key = nextKey();
        save(state.file, key, path.node.value);

        const replaceExpression = getReplaceExpression(path, key);
        if (replaceExpression) {
          path.replaceWith(replaceExpression);
          path.skip();
        }
      },
      TemplateLiteral(path, state) {
        if (state.imported || state.ignoreFile) return;
        if (path.node.skipTransform) return;

        const value = path
          .get("quasis")
          .map((item) => item.node.value.raw)
          .join("{placeholder}");
        if (value) {
          let key = nextKey();
          save(state.file, key, value);

          const replaceExpression = getReplaceExpression(path, key);
          path.replaceWith(replaceExpression);
          path.skip();
        }
      },
    },
    post(file) {
      const keys = file.get("keys");
      const intlData = keys.reduce((obj, item) => {
        obj[item.key] = item.value;
        return obj;
      }, {});

      const content = `${JSON.stringify(intlData, null, 4)}`;
      fse.ensureDirSync(options.output);
      fse.writeFileSync(path.join(options.output, "cn.json"), content);
      fse.writeFileSync(path.join(options.output, "en.json"), content);
    },
  };
};
