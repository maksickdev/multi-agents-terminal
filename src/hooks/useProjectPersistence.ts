import { useEffect, useRef } from "react";
import { loadProjects, saveProjects } from "../lib/tauri";
import { useStore } from "../store/useStore";

export function useProjectPersistence() {
  const { setProjects, projects } = useStore();
  const initialized = useRef(false);

  // Load on mount
  useEffect(() => {
    loadProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => {
        initialized.current = true;
      });
  }, []);

  // Save on change (skip initial load)
  useEffect(() => {
    if (!initialized.current) return;
    saveProjects(projects).catch(console.error);
  }, [projects]);
}
