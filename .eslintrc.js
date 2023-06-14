module.exports = {
  'env': {
    'es2021': true,
    'browser': true,
    "googleappsscript/googleappsscript": true,
  },
  'extends': [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 'latest',
    'sourceType': 'module',
    'project': './tsconfig.json',
  },
  'plugins': [
    '@typescript-eslint',
    'googleappsscript',
  ],
  'rules': {
  },
};
