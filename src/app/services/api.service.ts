import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ApiHttpOptions = {
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  observe?: 'body';
  params?: HttpParams | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
  reportProgress?: boolean;
  responseType?: 'json';
  withCredentials?: boolean;
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');

  /** Full URL for a path under `environment.apiUrl`. */
  url(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${this.apiUrl}${p}`;
  }

  get<T>(path: string, options?: ApiHttpOptions): Observable<T> {
    return this.http.get<T>(this.url(path), options);
  }

  post<T>(path: string, body: unknown | null, options?: ApiHttpOptions): Observable<T> {
    return this.http.post<T>(this.url(path), body, options);
  }

  put<T>(path: string, body: unknown | null, options?: ApiHttpOptions): Observable<T> {
    return this.http.put<T>(this.url(path), body, options);
  }

  patch<T>(path: string, body: unknown | null, options?: ApiHttpOptions): Observable<T> {
    return this.http.patch<T>(this.url(path), body, options);
  }

  delete<T>(path: string, options?: ApiHttpOptions): Observable<T> {
    return this.http.delete<T>(this.url(path), options);
  }

  /** POST when the API responds with a plain text body (e.g. `The new ID: …`). */
  postText(path: string, body: unknown | null): Observable<string> {
    return this.http.post(this.url(path), body, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text',
    });
  }
}
