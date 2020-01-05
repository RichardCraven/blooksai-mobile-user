export interface IAppConfig {
    env: {
        name: string;
        production: boolean;
    };
    apiEndpoints: {
        metadata: string;
        tesselate: string;
    };
}