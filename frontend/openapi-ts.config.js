import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:8000/api/v1/openapi.json',
  output: 'src/client',
  plugins: [
    {
      baseUrl: false,
      name: '@hey-api/client-fetch',
    },
    {
      name: '@tanstack/react-query',
      queryOptions: true,
      mutationOptions: true,
      useQuery: true,
      queryKeys: {
        tags: true,
      },
    },
  ],
});
