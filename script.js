let files = [];
let folderMappings = {};

document.getElementById('csvInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.csv')) {
        Papa.parse(file, {
            complete: function(results) {
                folderMappings = {};
                results.data.forEach(row => {
                    if (row.original_folder_name && row.new_folder_name) {
                        folderMappings[row.original_folder_name] = row.new_folder_name;
                    }
                });
                console.log('Folder mappings loaded:', folderMappings);
                previewRename(); // Re-run preview if files are already uploaded
            },
            header: true,
            skipEmptyLines: true
        });
    } else {
        alert('Please upload a valid CSV file.');
        folderMappings = {};
    }
});

function addFileInput() {
    const fileInputsDiv = document.getElementById('fileInputs');
    const newInputWrapper = document.createElement('div');
    newInputWrapper.className = 'file-input-wrapper';
    const newInput = document.createElement('input');
    newInput.type = 'file';
    newInput.className = 'fileInput';
    newInput.setAttribute('accept', '*/*');
    newInput.setAttribute('webkitdirectory', '');
    newInput.setAttribute('directory', '');
    newInput.addEventListener('change', updateFiles);
    newInputWrapper.appendChild(newInput);
    fileInputsDiv.appendChild(newInputWrapper);
}

function addMultipleInputs(count) {
    for (let i = 0; i < count; i++) {
        addFileInput();
    }
}

// Drag-and-Drop handling
const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
    console.log('Drag over detected');
});
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
    console.log('Drag leave detected');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    console.log('Drop detected, items:', e.dataTransfer.items.length);
    const folderItems = Array.from(e.dataTransfer.items).filter(item => {
        try {
            return item.webkitGetAsEntry().isDirectory;
        } catch (error) {
            console.warn('Skipping item due to error:', error);
            return false;
        }
    });
    if (folderItems.length === 0) {
        alert('Please drop folders only.');
        return;
    }
    files = [];
    let processedFolders = 0;
    const totalFolders = folderItems.length;

    function processFolder(entry, path = '') {
        return new Promise((resolve) => {
            const reader = entry.createReader();
            reader.readEntries(entries => {
                console.log(`Reading entries for ${path}:`, entries.length);
                const promises = [];
                entries.forEach(entry => {
                    if (entry.isDirectory) {
                        promises.push(processFolder(entry, path + entry.name + '/'));
                    } else {
                        promises.push(new Promise((fileResolve) => {
                            entry.file(file => {
                                // Sanitize and simplify the path to avoid encoding issues
                                const sanitizedPath = path + entry.name;
                                console.log(`Adding file: ${sanitizedPath}`);
                                file.webkitRelativePath = sanitizedPath.replace(/[^a-zA-Z0-9\-_/]/g, '_'); // Replace special chars
                                files.push(file);
                                fileResolve();
                            }, error => {
                                console.error('Error reading file:', error);
                                fileResolve(); // Continue even if a file fails
                            });
                        }));
                    }
                });
                Promise.all(promises).then(() => {
                    if (entries.length === 0) resolve();
                    resolve();
                }).catch(error => {
                    console.error('Error in processing entries:', error);
                    resolve(); // Continue processing despite errors
                });
            }, error => {
                console.error('Error reading entries:', error);
                resolve(); // Continue processing despite errors
            });
        });
    }

    folderItems.forEach(item => {
        const entry = item.webkitGetAsEntry();
        console.log(`Processing folder: ${entry.name}`);
        processFolder(entry).then(() => {
            processedFolders++;
            console.log(`Processed ${processedFolders} of ${totalFolders} folders`);
            if (processedFolders === totalFolders) {
                updateFiles();
            }
        }).catch(error => {
            console.error('Error processing folder:', error);
        });
    });
});

function updateFiles() {
    // No progress bar update here—reset to 0% if already visible
    updateProgress(0);
    document.getElementById('downloadBtn').disabled = files.length === 0;
}

// Initial setup for the first input
document.querySelector('.fileInput').addEventListener('change', updateFiles);

function groupFilesByFolder(files) {
    const groupedFiles = {};
    
    files.forEach(file => {
        // Extract folder name from webkitRelativePath if available, otherwise use 'root'
        let folderName = 'root';
        if (file.webkitRelativePath) {
            const pathParts = file.webkitRelativePath.split('/');
            folderName = pathParts.length > 1 ? pathParts[0] : 'root';
        }
        const fileName = file.name;
        
        // Skip .DS_Store files
        if (fileName === '.DS_Store') {
            return; // Skip this file
        }
        
        // Apply folder mapping if it exists
        if (folderMappings[folderName]) {
            folderName = folderMappings[folderName];
        }
        
        if (!groupedFiles[folderName]) {
            groupedFiles[folderName] = [];
        }
        groupedFiles[folderName].push(file);
    });
    
    // Sort files within each folder by their webkitRelativePath or name to maintain original order
    for (let folder in groupedFiles) {
        groupedFiles[folder].sort((a, b) => {
            const pathA = a.webkitRelativePath || a.name;
            const pathB = b.webkitRelativePath || b.name;
            return pathA.localeCompare(pathB);
        });
    }
    
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
            previewDiv.innerHTML += `<p>${file.webkitRelativePath || file.name} → ${newName}</p>`;
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