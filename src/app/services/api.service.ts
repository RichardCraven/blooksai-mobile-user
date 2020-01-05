import { Injectable } from '@angular/core';
import {
  HttpEventType,
  HttpClient,
  HttpRequest,
  HttpHeaders
} from '@angular/common/http';
import { ip_addresses } from '../../service-ips/ips';
import { AppConfig } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class APIService {
  TESSELATE_SERVER_URL = AppConfig.settings.apiEndpoints.tesselate
  BLOOSKAI_SERVER_URL = AppConfig.settings.apiEndpoints.metadata
  constructor(private httpClient: HttpClient) {}

  getVideos () {
    return this.httpClient.get(this.BLOOSKAI_SERVER_URL + '/videos')
  }
  getFrames () {
    return this.httpClient.get(this.BLOOSKAI_SERVER_URL + '/frames')
  }
  trainingStatus () {
    return this.httpClient.get(this.TESSELATE_SERVER_URL + '/training_status')
  }
  isQueryServerReady () {
    return this.httpClient.get(this.TESSELATE_SERVER_URL + '/start_query_server')
  }
}
