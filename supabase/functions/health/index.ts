// Función Edge opcional, sin privilegios ni claves secretas.
Deno.serve(() => Response.json({service:'cycling',status:'ok',runtime:'supabase-edge'}));
