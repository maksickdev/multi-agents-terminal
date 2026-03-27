import { pickFolder, saveProjects } from "../../lib/tauri";
import { useStore } from "../../store/useStore";
import { v4 as uuidv4 } from "uuid";

export function AddProjectButton() {
  const { addProject, projects } = useStore();

  const handleAdd = async () => {
    console.log("[AddProject] + clicked");
    try {
      console.log("[AddProject] calling pickFolder...");
      const folderPath = await pickFolder();
      console.log("[AddProject] pickFolder returned:", folderPath);
      if (!folderPath) return;

      const name = folderPath.split("/").pop() || folderPath;
      const project = { id: uuidv4(), name, path: folderPath };
      addProject(project);
      await saveProjects([...projects, project]);
    } catch (err) {
      console.error("Failed to add project:", err);
      alert(`Failed to add project: ${err}`);
    }
  };

  return (
    <button
      onClick={handleAdd}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#7aa2f7] hover:bg-[#1f2335] rounded transition-colors"
    >
      <span className="text-lg leading-none">+</span>
      <span>Add Project</span>
    </button>
  );
}
