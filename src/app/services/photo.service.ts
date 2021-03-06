import { Platform } from '@ionic/angular';
import { Injectable } from '@angular/core';
import { Plugins,
        CameraResultType,
        Capacitor,
        FilesystemDirectory,
        CameraPhoto,
        CameraSource } from '@capacitor/core';

const { Camera, Filesystem, Storage } = Plugins;

@Injectable({
  providedIn: 'root'
})
export class PhotoService {

    public photos: Photo[];
    private PHOTO_STORAGE: string = 'photos';
    private platform: Platform;

    constructor(platform: Platform) {
        this.platform = platform;
    }

    public async addNewToGallery() {
        // Take a photo
        const capturedPhoto = await Camera.getPhoto({
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
            quality: 100
        });

        // Save the picture and add it to photo collection
        const savedImageFile = await this.savePicture(capturedPhoto);
        this.photos.unshift(savedImageFile);

        Storage.set({
            key: this.PHOTO_STORAGE,
            value: JSON.stringify(this.photos)
        });
    }

    public async loadSaved() {
        const photoList = await Storage.get({ key: this.PHOTO_STORAGE });
        this.photos = JSON.parse(photoList.value) || [];

        if (!this.platform.is('hybrid')) {
            // Display the photo by reading into base64 format
            for (let photo of this.photos) {
                // Read each saved photo's data from the Filesystem
                const readFile = await Filesystem.readFile({
                    path: photo.filepath,
                    directory: FilesystemDirectory.Data
                });
            
                // Web platform only: Load the photo as base64 data
                photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
            }
        }
    }

    private async savePicture(cameraPhoto: CameraPhoto) {
        // Convert photo to base64 format, required by Filesystem API to save
        const base64Data = await this.readAsBase64(cameraPhoto);

        // Write the file to the data directory
        const fileName = new Date().getTime() + '.jpeg';
        const saveFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: FilesystemDirectory.Data
        });

        if (this.platform.is('hybrid')) {

            return {
                filepath: saveFile.uri,
                webviewPath: Capacitor.convertFileSrc(saveFile.uri)
            };
        }

        // Use webPath to display the new image instead of base64 since it's
        // already loaded into memory
        return {
            filepath: fileName,
            webviewPath: cameraPhoto.webPath
        };
    }

    private async readAsBase64(cameraPhoto: CameraPhoto) {

        // "hybrid will detect Capacitor or Cordova"
        if (this.platform.is('hybrid')) {
            const file = await Filesystem.readFile({
                path: cameraPhoto.path
            });

            return file.data;
        } else {
            const response = await fetch(cameraPhoto.webPath);
            const blob = await response.blob();

            return await this.convertBlobToBase64(blob) as string;
        }
    }

    convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
        const reader = new FileReader;
        reader.onerror = reject;
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });

    public async deletePicture(photo: Photo, position: number) {
        // Remove this photo from the Photos reference data array
        this.photos.splice(position, 1);

        // Update photos array cache by overwriting the existing photo array
        Storage.set({
            key: this.PHOTO_STORAGE,
            value: JSON.stringify(this.photos)
        });

        // delete photo file from filesystem
        const filename = photo.filepath.substr(photo.filepath.lastIndexOf('/') + 1);

        await Filesystem.deleteFile({
            path: filename,
            directory: FilesystemDirectory.Data
        });
    }
}

export interface Photo {
    filepath: string;
    webviewPath: string;
}
