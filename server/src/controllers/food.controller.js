import Food from "../models/Food.js";
import * as factory from "./crudFactory.js";

export const listActiveFoods = factory.listActive(Food);
export const getActiveFoodById = factory.getActiveById(Food);
export const listAllFoods = factory.listAll(Food);
export const createFood = factory.createOne(Food);
export const updateFood = factory.updateOne(Food);
export const setFoodStatus = factory.setActiveStatus(Food);
export const deleteFood = factory.deleteOneUnlessBooked(Food, "food", "food item");
