import { Component, OnInit, ChangeDetectorRef, NgZone  } from '@angular/core';
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/Camera/ngx';
import { ActionSheetController, ToastController, Platform, LoadingController } from '@ionic/angular';
import { File, FileEntry } from '@ionic-native/File/ngx';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { Storage } from '@ionic/storage';
import { FilePath } from '@ionic-native/file-path/ngx';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
 
import { finalize } from 'rxjs/operators';
import {
  HttpEventType,
  HttpClient,
  HttpRequest,
  HttpHeaders
} from '@angular/common/http';
import { APIService } from '../services/api.service';

const STORAGE_KEY = 'my_images';
 
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  itemFound = false;
  itemsFound = [];
  images = [];
  objectName = '';
  salespointUrl = '';
 
  constructor(private camera: Camera, private file: File, private http: HttpClient, private webview: WebView,
    private actionSheetController: ActionSheetController, private toastController: ToastController,
    private storage: Storage, private platform: Platform, private loadingController: LoadingController,
    private ref: ChangeDetectorRef, private filePath: FilePath, private APIService: APIService, private zone: NgZone) { }
 
  ngOnInit() {
    this.platform.ready().then(() => {
      this.loadStoredImages();
    });
  }
 
  loadStoredImages() {
    this.APIService.trainingStatus().subscribe((res) => {
      console.log('training status: ', res)
    })
    this.APIService.isQueryServerReady().subscribe((res) => {
      console.log('query server status: ', res)
    })
    this.storage.get(STORAGE_KEY).then(images => {
      if (images) {
        let arr = JSON.parse(images);
        this.images = [];
        for (let img of arr) {
          let filePath = this.file.dataDirectory + img;
          let resPath = this.pathForImage(filePath);
          this.images.push({ name: img, path: resPath, filePath: filePath });
        }
      }
    });
  }
 
  pathForImage(img) {
    if (img === null) {
      return '';
    } else {
      let converted = this.webview.convertFileSrc(img);
      return converted;
    }
  }
 
  async presentToast(text) {
    const toast = await this.toastController.create({
        message: text,
        position: 'bottom',
        duration: 3000
    });
    toast.present();
  }
  async selectImage() {
    const actionSheet = await this.actionSheetController.create({
        header: "Select Image source",
        buttons: [{
                text: 'Load from Library',
                handler: () => {
                    this.takePicture(this.camera.PictureSourceType.PHOTOLIBRARY);
                }
            },
            {
                text: 'Use Camera',
                handler: () => {
                    this.takePicture(this.camera.PictureSourceType.CAMERA);
                }
            },
            {
                text: 'Cancel',
                role: 'cancel'
            }
        ]
    });
    await actionSheet.present();
  }
  
  takePicture(sourceType: PictureSourceType) {
    console.log('in take picture')
      var options: CameraOptions = {
          quality: 80,
          sourceType: sourceType,
          saveToPhotoAlbum: false,
          correctOrientation: false
      };
  
      this.camera.getPicture(options).then(imagePath => {
          if (this.platform.is('android') && sourceType === this.camera.PictureSourceType.PHOTOLIBRARY) {
              this.filePath.resolveNativePath(imagePath)
                  .then(filePath => {
                      let correctPath = filePath.substr(0, filePath.lastIndexOf('/') + 1);
                      let currentName = imagePath.substring(imagePath.lastIndexOf('/') + 1, imagePath.lastIndexOf('?'));
                      this.copyFileToLocalDir(correctPath, currentName, this.createFileName());
                  });
          } else {
              var currentName = imagePath.substr(imagePath.lastIndexOf('/') + 1);
              var correctPath = imagePath.substr(0, imagePath.lastIndexOf('/') + 1);
              this.copyFileToLocalDir(correctPath, currentName, this.createFileName());
          }
      });
  
    }
  createFileName() {
      var d = new Date(),
          n = d.getTime(),
          newFileName = n + ".jpg";
      return newFileName;
  }
  
  copyFileToLocalDir(namePath, currentName, newFileName) {
      this.file.copyFile(namePath, currentName, this.file.dataDirectory, newFileName).then(success => {
          this.updateStoredImages(newFileName);
      }, error => {
          this.presentToast('Error while storing file.');
      });
  }
  
  updateStoredImages(name) {
    
      this.storage.get(STORAGE_KEY).then(images => {
          let arr = JSON.parse(images);
          if (!arr) {
              let newImages = [name];
              this.storage.set(STORAGE_KEY, JSON.stringify(newImages));
          } else {
              arr.push(name);
              this.storage.set(STORAGE_KEY, JSON.stringify(arr));
          }
  
          let filePath = this.file.dataDirectory + name;
          let resPath = this.pathForImage(filePath);
  
          let newEntry = {
              name: name,
              path: resPath,
              filePath: filePath
          };
  
          this.images = [newEntry, ...this.images];
          this.ref.detectChanges(); // trigger change detection cycle
      });
  }
  deleteImage(imgEntry, position) {
    this.images.splice(position, 1);
 
    this.storage.get(STORAGE_KEY).then(images => {
        let arr = JSON.parse(images);
        let filtered = arr.filter(name => name != imgEntry.name);
        this.storage.set(STORAGE_KEY, JSON.stringify(filtered));
 
        var correctPath = imgEntry.filePath.substr(0, imgEntry.filePath.lastIndexOf('/') + 1);
 
        this.file.removeFile(correctPath, imgEntry.name).then(res => {
            this.presentToast('File removed.');
        });
    });
  }
  startUpload(imgEntry) {
    this.file.resolveLocalFilesystemUrl(imgEntry.filePath)
        .then(entry => {
            ( < FileEntry > entry).file(file => this.readFile(file))
        })
        .catch(err => {
            this.presentToast('Error while reading file.');
        });
  }
  
  readFile(file: any) {
    const reader = new FileReader();
    reader.onload = () => {
        const formData = new FormData();
        const imgBlob = new Blob([reader.result], {
            type: file.type
        });
        formData.append('file', imgBlob, file.name);
        this.uploadImageData(formData);
    };
    reader.readAsArrayBuffer(file);
  }

  async uploadImageData(formData: FormData) {
    const loading = await this.loadingController.create({
        message: 'Uploading image...',
    });
    await loading.present();
    this.http.request(new HttpRequest('POST', this.APIService.TESSELATE_SERVER_URL + '/query', formData, { reportProgress: true }))
        .pipe(
            finalize(() => {
                loading.dismiss();
            })
        )
        .subscribe(res => {
          if (res.type === HttpEventType.UploadProgress) {
          }
          if (res.type === HttpEventType.Response){
            this.checkAgainstMetaData(res.body)
              if (res.status == 200) {
                  this.presentToast('File upload complete.')
              } else {
                  this.presentToast('File upload failed.')
              }
          }
        }
    );
  }
  formatApiKey(key){
    let newstring = []
    for(let i = 0 ; i < 6; i++){
      if(key[i] === '*'){
        break;
      }
      newstring.push(key[i])
    }
    return newstring.join('');
  }
  checkAgainstMetaData(arr : any) {
    this.APIService.getFrames().subscribe((res) => {
      res['_embedded'].frames.forEach(frame => {
        if(frame._embedded && frame._embedded.videoByVideoId.videoName == arr[0]){
            if(this.formatApiKey(frame.apiFrameKey) == arr[1]){
              this.zone.run(() => {
                let data = JSON.parse(frame.objJson1)
                data.forEach(item => {
                  this.itemsFound.push(item)
                });
                this.itemFound = true;
              });
            }
        }
      });
      if(!this.itemFound){
        console.log('item not found')
      }
    })
  }
}