let files = [];

function addFolderInput() {
    const fileInputsDiv = document.getElementById('fileInputs');
    const newInputWrapper = document.createElement('div');
    newInputWrapper.className = 'file-input-wrapper';
    const newInput = document.createElement('input');
    newInput.type = 'file';
    newInput.className = 'folderInput';
    newInput.setAttribute('webkitdirectory', '');
    newInput.setAttribute('directory', '');
    newInput.setAttribute('accept', '*/*');
    newInput.addEventListener('change', updateFiles);
    newInputWrapper.appendChild(newInput);
    fileInputsDiv.appendChild(newInputWrapper);
}

function updateFiles() {
    files = [];
    const inputs = document.getElementsByClassName('folderInput');
    Array.from(inputs).forEach(input => {
        if (input.files.length > 0) {
            files = files.concat(Array.from(input.files));
        }
    });
    // No progress bar update here—reset to 0% if already visible
    updateProgress(0);
    document.getElementById('downloadBtn').disabled = files.length === 0;
}

function groupFilesByFolder(files) {
    const groupedFiles = {};
    
    files.forEach(file => {
        // Extract folder name from webkitRelativePath (e.g., "folder1/file.txt" -> "folder1")
        const pathParts = file.webkitRelativePath.split('/');
        const folderName = pathParts.length > 1 ? pathParts[0] : 'root';
        const fileName = pathParts[pathParts.length - 1];
        
        // Skip .DS_Store files
        if (fileName === '.DS_Store') {
            return; // Skip this file
        }
        
        if (!groupedFiles[folderName]) {
            groupedFiles[folderName] = [];
        }
        groupedFiles[folderName].push(file);
    });
    
    return groupedFiles;
}

function generateNewName(file, index, folderName) {
    const extension = file.name.split('.').pop();
    // Use folder name as prefix with "-" separator and no padding on number
    const newName = `${folderName}-${index + 1}`;
    return `${newName}.${extension}`;
}

function updateProgress(percentage) {
    const progress = document.getElementById('progress');
    progress.style.width = `${percentage}%`;
    progress.textContent = `${Math.round(percentage)}%`;
}

function previewRename() {
    updateProgress(0); // Start at 0% for preview
    const groupedFiles = groupFilesByFolder(files);
    const previewDiv = document.getElementById('preview');
    previewDiv.innerHTML = '<h3>Preview:</h3>';
    
    let totalFiles = 0;
    for (const folderFiles of Object.values(groupedFiles)) {
        totalFiles += folderFiles.length;
    }
    let processedFiles = 0;

    for (const [folderName, folderFiles] of Object.entries(groupedFiles)) {
        folderFiles.forEach((file, index) => {
            const newName = generateNewName(file, index, folderName);
            previewDiv.innerHTML += `<p>${file.webkitRelativePath} → ${newName}</p>`;
            processedFiles++;
            updateProgress((processedFiles / totalFiles) * 50); // 0-50% for preview
        });
    }
    
    document.getElementById('downloadBtn').disabled = files.length === 0;
    updateProgress(50); // Preview done, 50% complete
}

function downloadRenamed() {
    updateProgress(50); // Start download at 50%
    const groupedFiles = groupFilesByFolder(files);
    const zip = new JSZip();
    
    let totalFiles = 0;
    let processedFiles = 0;
    for (const folderFiles of Object.values(groupedFiles)) {
        totalFiles += folderFiles.length;
    }

    for (const [folderName, folderFiles] of Object.entries(groupedFiles)) {
        const folder = zip.folder(folderName); // Create a folder in the ZIP
        folderFiles.forEach((file, index) => {
            const newName = generateNewName(file, index, folderName);
            folder.file(newName, file);
            processedFiles++;
            updateProgress(50 + (processedFiles / totalFiles) * 50); // 50-100% for ZIP
        });
    }
    
    zip.generateAsync({type: "blob"}).then((content) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'renamed_files.zip';
        link.click();
        updateProgress(100); // Download complete
    });
}

// Initial setup for the first input
document.querySelector('.folderInput').addEventListener('change', updateFiles);