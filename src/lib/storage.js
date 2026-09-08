import localforage from 'localforage';

localforage.config({
  name: 'LassoApp',
  storeName: 'documents'
});

export const saveDocumentMetadata = async (id, name, pdfBlob) => {
  await localforage.setItem(`doc_${id}`, { name, lastModified: Date.now(), pdfBlob });
};

export const saveAnnotations = async (id, paths) => {
  await localforage.setItem(`ann_${id}`, paths);
  
  // Update last modified on the document
  const doc = await localforage.getItem(`doc_${id}`);
  if (doc) {
    await localforage.setItem(`doc_${id}`, { ...doc, lastModified: Date.now() });
  }
};

export const getDocument = async (id) => {
  const doc = await localforage.getItem(`doc_${id}`);
  const annotations = await localforage.getItem(`ann_${id}`) || [];
  return { ...doc, annotations };
};

export const getAllDocuments = async () => {
  const docs = [];
  const keys = await localforage.keys();
  for (const key of keys) {
    if (key.startsWith('doc_')) {
      const doc = await localforage.getItem(key);
      docs.push({ id: key.replace('doc_', ''), name: doc.name, lastModified: doc.lastModified });
    }
  }
  return docs.sort((a, b) => b.lastModified - a.lastModified);
};

export const renameDocument = async (id, newName) => {
  const doc = await localforage.getItem(`doc_${id}`);
  if (doc) {
    await localforage.setItem(`doc_${id}`, { ...doc, name: newName });
  }
};

export const deleteDocument = async (id) => {
  await localforage.removeItem(`doc_${id}`);
  await localforage.removeItem(`ann_${id}`);
};

export const clearAllDocuments = async () => {
  await localforage.clear();
};
