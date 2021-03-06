const fs = require('fs');
const path = require('path');
const { Visitor } = require('@swc/core/Visitor');

const { getTsConfig } = require('./config');

module.exports = class AliasPluginVisitor extends Visitor {
  root = process.cwd();
  alias = this.resolveAlias();
  entry = process.argv[2];
  file;

  constructor(file) {
    super();
    this.file = file;
  }

  visitTsType(n) {
    return n;
  }

  resolveAlias() {
    const config = getTsConfig();
    if (config && config.compilerOptions && config.compilerOptions.paths) {
      const aliasObj = config.compilerOptions.paths;
      return Object.fromEntries(
        Object.keys(aliasObj).map(alias => [
          this.resolveAliasPathRegexpStr(alias),
          aliasObj[alias],
        ]),
      );
    }
    return null;
  }

  resolveAliasPathRegexpStr(alias) {
    return '^' + alias.replace(/\*/, '([\\s|\\S]*)') + '$';
  }

  visitImportDeclaration(n) {
    const matchAliasKey = Object.keys(this.alias).find(aliasRegexp => new RegExp(aliasRegexp).test(n.source.value));

    if (matchAliasKey) {
      const patMatchStr = new RegExp(matchAliasKey).exec(n.source.value)[1];

      for (let i = 0, len = this.alias[matchAliasKey].length; i < len; i += 1) {
        const targetPath = this.alias[matchAliasKey][i];
        const targetAbsolutePath = path.join(this.root, targetPath.replace(/\*/, patMatchStr));
        
        if (this.existsSync(targetAbsolutePath)) {
          let relativePath = path.relative(path.dirname(this.file.absolute), targetAbsolutePath);
          
          if (!['./', '../'].some(ps => relativePath.startsWith(ps))) {
            relativePath = './' + relativePath;
          }

          return {
            ...n,
            source: {
              ...n.source,
              value: relativePath,
            },
          };
        }
      }
    }

    return n;
  }

  existsSync(path) {
    const exts = ['', '.js', '.es6', '.es', '.mjs', '.ts', '.cjs', '.json'];

    return exts.some(ext => fs.existsSync(path + ext));
  }
}
