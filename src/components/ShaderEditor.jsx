/**
 * ShaderEditor — Tabs + textareas for vertex/fragment shaders.
 * Debounced auto-run on input. Exposes shader sources via onChange.
 * ref exposes run() to flush editor state and trigger recompile.
 */
import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import fragmentSource from '../shaders/fragment.glsl?raw';
import vertexSource from '../shaders/vertex.glsl?raw';
import styles from './ShaderEditor.module.css';

export const ShaderEditor = forwardRef(function ShaderEditor(
  { vertexSource: vs, fragmentSource: fs, onChange, onRun },
  ref
) {
  const [activeTab, setActiveTab] = useState('fragment');
  const [vertex, setVertex] = useState(vs ?? vertexSource);
  const [fragment, setFragment] = useState(fs ?? fragmentSource);
  const debounceRef = useRef(null);
  const sourcesRef = useRef({ vertex, fragment });
  sourcesRef.current = { vertex, fragment };

  const scheduleRun = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const { vertex: v, fragment: f } = sourcesRef.current;
      onChange?.({ vertex: v, fragment: f });
      onRun?.();
    }, 500);
  }, [onChange, onRun]);

  const handleVertexChange = (e) => {
    const v = e.target.value;
    setVertex(v);
    scheduleRun();
  };

  const handleFragmentChange = (e) => {
    const f = e.target.value;
    setFragment(f);
    scheduleRun();
  };

  const handleRun = () => {
    const { vertex: v, fragment: f } = sourcesRef.current;
    onChange?.({ vertex: v, fragment: f });
    onRun?.();
  };

  useEffect(() => {
    onChange?.({ vertex, fragment });
  }, []);

  useImperativeHandle(ref, () => () => {
    const { vertex: v, fragment: f } = sourcesRef.current;
    onChange?.({ vertex: v, fragment: f });
  });

  return (
    <div className={styles.panel}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'vertex' ? styles.active : ''}`}
          onClick={() => setActiveTab('vertex')}
        >
          Vertex Shader
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'fragment' ? styles.active : ''}`}
          onClick={() => setActiveTab('fragment')}
        >
          Fragment Shader
        </button>
      </div>
      <div className={styles.editors}>
        <textarea
          className={styles.editor}
          spellCheck={false}
          value={vertex}
          onChange={handleVertexChange}
          style={{ display: activeTab === 'vertex' ? 'block' : 'none' }}
        />
        <textarea
          className={styles.editor}
          spellCheck={false}
          value={fragment}
          onChange={handleFragmentChange}
          style={{ display: activeTab === 'fragment' ? 'block' : 'none' }}
        />
      </div>
    </div>
  );
});
