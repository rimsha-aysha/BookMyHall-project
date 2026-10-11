import Decoration from "../models/Decoration.js";
import * as factory from "./crudFactory.js";

export const listActiveDecorations = factory.listActive(Decoration);
export const getActiveDecorationById = factory.getActiveById(Decoration);
export const listAllDecorations = factory.listAll(Decoration);
export const createDecoration = factory.createOne(Decoration);
export const updateDecoration = factory.updateOne(Decoration);
export const setDecorationStatus = factory.setActiveStatus(Decoration);
export const deleteDecoration = factory.deleteOneUnlessBooked(Decoration, "decorations", "decoration");
