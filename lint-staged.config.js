module.exports = {
  'src/**/*.{js,jsx,ts,tsx,json,css}': (files) => {
    const filesToCheck = files
      .filter(file => !file.includes('src/components/ui/'))
      .join(' ');

    if (!filesToCheck) return [];

    return [
      `prettier --check ${filesToCheck}`,
      `eslint ${filesToCheck}`,
      'tsc --noEmit'
    ];
  }
};
