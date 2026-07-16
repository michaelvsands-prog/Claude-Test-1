import localforage from 'localforage';

const store = localforage.createInstance({ name: 'srm-tool', storeName: 'srm' });

/**
 * @typedef {Object} UploadRecord
 * @property {string} id
 * @property {string} vendor   one of VENDORS
 * @property {string} type     one of TYPES
 * @property {string} user
 * @property {string} fileName
 * @property {string} uploadedAt   ISO timestamp
 * @property {string[]} headers    original order preserved
 * @property {Object<string,string[]>} samplesByHeader  up to 50 non-empty values per column
 * @property {number} rowCount
 */

export const getUploads = async () => (await store.getItem('uploads')) || [];
export const saveUploads = (uploads) => store.setItem('uploads', uploads);

/** overrides: { [uploadId]: { [attrId]: string|null } } */
export const getOverrides = async () => (await store.getItem('overrides')) || {};
export const saveOverrides = (overrides) => store.setItem('overrides', overrides);

/** selection: { type, uploadIds: string[] } */
export const getSelection = async () =>
  (await store.getItem('compareSelection')) || { type: 'Reference', uploadIds: [] };
export const saveSelection = (sel) => store.setItem('compareSelection', sel);
