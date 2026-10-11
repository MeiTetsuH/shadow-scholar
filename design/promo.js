// Deterministic promotional artwork. This file is not packaged in the extension.
document.body.classList.toggle('small', new URLSearchParams(location.search).get('size') === 'small');
