-- DATOS SINTÉTICOS PARA PROBAR LA UI. NO SON RUTAS SEGURAS NI CICLOVÍAS VERIFICADAS.
-- Ejecutar una sola vez después de la migración inicial.
insert into public.cycling_routes(title,description,distance_km,difficulty,duration_min,ascent_m,path,is_demo)
values
('Circuito urbano · DEMO','Recorrido ilustrativo NO apto para navegación real.',6.2,'easy',28,30,extensions.ST_GeomFromText('LINESTRING(-77.0365 -12.0925,-77.0412 -12.1002,-77.0370 -12.1080,-77.0281 -12.1132,-77.0228 -12.1064)',4326),true),
('Ruta panorámica · DEMO','Trazado sintético no validado.',11.4,'moderate',52,65,extensions.ST_GeomFromText('LINESTRING(-77.0501 -12.1022,-77.0450 -12.1096,-77.0371 -12.1161,-77.0270 -12.1230,-77.0180 -12.1280)',4326),true),
('Entrenamiento · DEMO','Ruta ficticia: no circular siguiéndola.',18.7,'hard',82,125,extensions.ST_GeomFromText('LINESTRING(-77.0280 -12.0900,-77.0230 -12.1000,-77.0175 -12.1120,-77.0100 -12.1200,-77.0020 -12.1310)',4326),true);
insert into public.bike_lanes(name,kind,path,is_demo) values
('Ciclovía ilustrativa A','dedicated',extensions.ST_GeomFromText('LINESTRING(-77.041 -12.102,-77.037 -12.108,-77.029 -12.112)',4326),true),
('Ciclovía ilustrativa B','shared',extensions.ST_GeomFromText('LINESTRING(-77.048 -12.114,-77.04 -12.117,-77.033 -12.121)',4326),true);
