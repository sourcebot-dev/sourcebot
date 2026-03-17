import { z } from "zod";
import { ToolDefinition } from "./types";
import description from "./weather.txt";

// -----------------------------------------------------------------------
// Weather tool
// -----------------------------------------------------------------------

const weatherShape = {
    city: z.string().describe("The name of the city to get the weather for."),
};

export type WeatherMetadata = {
    city: string;
    temperatureC: number;
    condition: string;
};

export const weatherDefinition: ToolDefinition<"weather", typeof weatherShape, WeatherMetadata> = {
    name: "weather",
    description,
    inputSchema: z.object(weatherShape),
    execute: async ({ city }) => {
        // Dummy response
        const metadata: WeatherMetadata = {
            city,
            temperatureC: 22,
            condition: "Partly cloudy",
        };
        return {
            output: `The weather in ${city} is ${metadata.condition} with a temperature of ${metadata.temperatureC}°C.`,
            metadata,
        };
    },
};
