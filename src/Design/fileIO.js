import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

export class FileIO {
  // TODO: FileIO needs to be refactored considering the following:
  // 1. File open dialogs should be transient to the application window
  // 2. The application window will need to create a new TabPage and Canvas before files can be opened
  // 3. File data needs to be loaded relevant to the canvas object
  // 4. Autosave will need to be tracked on the canvas with a timer
  // 5. Success notifications will need to be returned to the application window

  static formatFilename(fileName) {
    const formattedName = fileName.replace(/\.[^/.]+$/, '');
    return formattedName;
  }

  static getFileExtension(fileName) {
    const extension = fileName.split('.').pop();
    return extension;
  }

  static openDialog(window) {
    const filter = new Gtk.FileFilter();
    filter.add_pattern('*.dxf');

    const dialog = new Gtk.FileChooserNative({
      action: Gtk.FileChooserAction.OPEN,
      filter: filter,
      select_multiple: false,
      transient_for: window,
      title: 'Open',
    });

    dialog.show();
    dialog.connect('response', (dialog, response) => {
      if (response == Gtk.ResponseType.ACCEPT) {
        const file = dialog.get_file();
        this.loadFile(file, window);
      }
    });
  }

  static openFile(file) {
    const [, contents] = file.load_contents(null);
    const decoder = new TextDecoder('utf-8');
    // decode the file contents from a bitearray
    const fileContents = decoder.decode(contents);
    return fileContents;
  }

  static loadFile(file, window) {
    if (!file.query_exists(null)) {
      // TODO: inform user that the selected file is invalid.
      return;
    }

    // get filename
    const info = file.query_info('standard::*', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    const fileName = this.formatFilename(info.get_name());
    const ext = this.getFileExtension(info.get_name());

    if (ext.toLowerCase() !== 'dxf') {
      // TODO: inform user that the file type is not supported.
      return;
    }

    const fileContents = this.openFile(file);
    // create a new canvas with the filename in the tab
    window.addCanvas(fileName);
    // load the file contents into the active canvas
    window.getActiveCanvas().core.openFile(fileContents);
    // set the active file path
    window.getActiveCanvas().setFilePath(file.get_path());
    // handle tab changes in the window object
    window.onTabChange();
  }

  static save(window) {
    const filePath = window.getActiveCanvas().getFilePath();
    if (filePath) {
      // Save to existing file
      this.saveFile(filePath, window);
    } else {
      // save to new file
      this.saveDialog(window);
    }
  }

  static saveFile(filePath, window) {
    if (filePath) {
      const file = Gio.File.new_for_path(filePath);

      const dxfContents = window.getActiveCanvas().core.saveFile();

      const [success] = file.replace_contents(dxfContents, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);

      if (success) {
        // TODO: Janky sending notifications through core
        window.getActiveCanvas().core.notify('File Saved');
      } else {
        window.getActiveCanvas().core.notify('Error Saving File');
      }
    }
  }

  static saveDialog(window) {
    const filter = new Gtk.FileFilter();
    filter.add_pattern('*.dxf');

    const dialog = new Gtk.FileChooserNative({
      action: Gtk.FileChooserAction.SAVE,
      filter: filter,
      select_multiple: false,
      transient_for: window,
      title: 'Save As',
    });

    const name = this.formatFilename(window._tabView.get_selected_page().get_title());
    dialog.set_current_name(`${name}.dxf`);

    dialog.show();
    dialog.connect('response', (dialog, response) => {
      if (response == Gtk.ResponseType.ACCEPT) {
        const file = dialog.get_file();
        const filePath = file.get_path();

        this.saveFile(filePath, window);

        // update page name
        const info = file.query_info('standard::*', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        const fileName = info.get_name();
        const tabTitle = window._tabView.get_selected_page().get_title();

        // set the active file path
        window.getActiveCanvas().setFilePath(filePath);

        if (fileName !== tabTitle) {
          const page = window._tabView.get_selected_page();
          page.set_title(fileName);
        }
      }
    });
  }
}
