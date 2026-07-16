import React, { createContext, useContext, useEffect, useReducer } from 'react';
import * as db from './db.js';

const AppContext = createContext(null);

const initialState = {
  hydrated: false,
  activeTab: 'uploads',
  uploads: [],
  overrides: {},
  selection: { type: 'Reference', uploadIds: [] },
};

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload, hydrated: true };
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };
    case 'ADD_UPLOAD':
      return { ...state, uploads: [...state.uploads, action.upload] };
    case 'UPDATE_UPLOAD_META':
      return {
        ...state,
        uploads: state.uploads.map((u) =>
          u.id === action.id ? { ...u, ...action.patch } : u
        ),
      };
    case 'DELETE_UPLOAD': {
      const overrides = { ...state.overrides };
      delete overrides[action.id];
      return {
        ...state,
        uploads: state.uploads.filter((u) => u.id !== action.id),
        overrides,
        selection: {
          ...state.selection,
          uploadIds: state.selection.uploadIds.filter((id) => id !== action.id),
        },
      };
    }
    case 'SET_OVERRIDE': {
      const { uploadId, attrId, value } = action; // value: header string | null (cleared)
      const forUpload = { ...(state.overrides[uploadId] || {}), [attrId]: value };
      return { ...state, overrides: { ...state.overrides, [uploadId]: forUpload } };
    }
    case 'CLEAR_OVERRIDE': {
      const { uploadId, attrId } = action;
      const forUpload = { ...(state.overrides[uploadId] || {}) };
      delete forUpload[attrId];
      return { ...state, overrides: { ...state.overrides, [uploadId]: forUpload } };
    }
    case 'SET_SELECTION':
      return { ...state, selection: action.selection };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const [uploads, overrides, selection] = await Promise.all([
        db.getUploads(),
        db.getOverrides(),
        db.getSelection(),
      ]);
      dispatch({ type: 'HYDRATE', payload: { uploads, overrides, selection } });
    })();
  }, []);

  useEffect(() => {
    if (state.hydrated) db.saveUploads(state.uploads);
  }, [state.hydrated, state.uploads]);
  useEffect(() => {
    if (state.hydrated) db.saveOverrides(state.overrides);
  }, [state.hydrated, state.overrides]);
  useEffect(() => {
    if (state.hydrated) db.saveSelection(state.selection);
  }, [state.hydrated, state.selection]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
