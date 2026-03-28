export interface Location {
	name: string;
	re: number;
	im: number;
	zoom: number;
}

export const PRESET_LOCATIONS: Location[] = [
	{ name: "Overview",            re: -0.5,          im:  0.0,        zoom:  3 },
	{ name: "Seahorse Valley",     re: -0.7453954,    im:  0.1125492,  zoom:  9 },
	{ name: "Elephant Valley",     re:  0.2925755,    im: -0.0149491,  zoom:  9 },
	{ name: "Double Spiral",       re: -0.747,        im:  0.1075,     zoom: 11 },
	{ name: "Feigenbaum Point",    re: -1.401155189,  im:  0.0,        zoom: 12 },
	{ name: "Quad Spiral",         re: -0.7269,       im:  0.1889,     zoom: 10 },
	{ name: "Mini Mandelbrot",     re: -1.7549,       im:  0.0,        zoom: 10 },
	{ name: "Siegel Disk",         re: -0.3905407,    im:  0.5867879,  zoom: 11 },
	{ name: "San Marco Dragon",    re: -0.7454294,    im:  0.1130089,  zoom: 15 },
	{ name: "North Radical",       re: -0.1592,       im:  1.0317,     zoom:  9 },
	{ name: "Parabolic Point",     re:  0.25,         im:  0.0,        zoom:  8 },
	{ name: "Julia Island",        re: -1.2943,       im:  0.4408,     zoom: 11 },
	{ name: "Cauliflower",         re:  0.275,        im:  0.007,      zoom:  9 },
	{ name: "Lightning",           re: -1.6744,       im:  0.0,        zoom: 10 },
	{ name: "Misiurewicz M32",     re: -0.1011,       im:  0.9563,     zoom: 13 },
	{ name: "Misiurewicz M43",     re: -1.5437,       im:  0.0,        zoom: 12 },
	{ name: "Baby Seahorse",       re: -0.7408,       im:  0.1614,     zoom: 14 },
	{ name: "Oblique Spiral",      re: -0.5551,       im:  0.6266,     zoom: 12 },
];
