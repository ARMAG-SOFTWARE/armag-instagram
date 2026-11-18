/** @type {import('next').NextConfig} */
const nextConfig = {
  // as rotas de criativos leem fontes, brasão e o PADRAO.md do disco em produção
  outputFileTracingIncludes: {
    "/api/criativos/**": ["./criativos/marca/**/*", "./criativos/PADRAO.md"],
  },
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
