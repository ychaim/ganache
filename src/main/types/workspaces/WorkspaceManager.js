import path from "path";
import fse from "fs-extra";
import Workspace from "./Workspace";
import WorkspaceSettings from "../settings/WorkspaceSettings";

class WorkspaceManager {
  constructor(directory) {
    this.directory = directory;
    this.workspaces = [];
  }

  enumerateWorkspaces() {
    const workspacesDirectory = path.join(this.directory, "workspaces");
    if (fse.existsSync(workspacesDirectory)) {
      this.workspaces = fse
        .readdirSync(workspacesDirectory)
        .flatMap(file => {
          if (!fse.lstatSync(path.join(workspacesDirectory, file)).isDirectory) {
            return [];
          }
          // if an osx user navigates to the workspaces directory osx will put a
          // .DS_Store folder there, ignore these.
          if (file === ".DS_Store") {
            return []
          }

          let settings = new WorkspaceSettings(
            path.join(workspacesDirectory, file),
            path.join(workspacesDirectory, file, "chaindata"),
          );
          
          const isQuickstart = settings.get("isDefault");
          if (isQuickstart) {
            // the default workspace shouldn't be in the "workspaces" directory,
            // delete it.
            fse.remove(settings.settings.directory).catch(e => e);
            return [];
          }
          settings.bootstrap();

          const name = settings.get("name");
          const sanitizedName = Workspace.getSanitizedName(name);
          if (sanitizedName !== file) {
            // apparently the Settings file has a name that is not equal to the directory,
            //   we need to move the directory
            try {
              fse.moveSync(
                path.join(workspacesDirectory, file),
                path.join(workspacesDirectory, sanitizedName),
              );
            } catch(e) {
              // It's okay that we ignore move errors, promise!
              // This happens because a user tried to name two or more
              // workspaces with the same name. We only name workspace folders
              // by name because it is a little easier for us to debug.
              // We should *probably* just append the uuid of the workspace
              // to the dir name, to ensure uniqueness.
              console.log(e);
            }
          }
          const flavor = settings.get("flavor");
          return [new Workspace(name, this.directory, flavor)];
        });
    }

    this.workspaces.push(new Workspace(null, this.directory, "ethereum"));
    this.workspaces.push(new Workspace(null, this.directory, "corda"));
  }

  bootstrap() {
    this.enumerateWorkspaces();
    for (let i = 0; i < this.workspaces.length; i++) {
      this.workspaces[i].bootstrap();
    }
  }

  getNonDefaultNames() {
    return this.workspaces
      .filter(workspace => workspace.name !== null)
      .map(workspace => ({name: workspace.name, flavor: workspace.flavor}));
  }

  get(name, flavor = "ethereum") {
    return this.workspaces.find(workspace => name === workspace.name && isFlavor(workspace.flavor, flavor));
  }
}

function isFlavor(flavorA, flavorB){
  if (flavorA === undefined && flavorB === "ethereum") {
    return true;
  } else {
    return flavorA === flavorB;
  }
}

export default WorkspaceManager;
