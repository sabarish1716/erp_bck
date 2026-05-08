export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type EndpointAction = {
  title: string;
  method: HttpMethod;
  path: string;
  query?: string[];
  params?: string[];
  body?: Record<string, unknown>;
  requiredAnyPermissions?: string[];
};

export type EndpointGroup = {
  id: string;
  label: string;
  icon: string;
  actions: EndpointAction[];
  requiredAnyPermissions?: string[];
};

export type HrClientConfig = {
  baseUrl: string;
  token?: string;
};

export type ApiResult = {
  ok: boolean;
  status: number;
  method: HttpMethod;
  endpoint: string;
  data: unknown;
};

export type AuthMeProfile = {
  id?: string | number;
  email?: string;
  role?: string;
  permissions?: string[];
};
