import AdditionalService from "../models/AdditionalService.js";
import * as factory from "./crudFactory.js";

export const listActiveServices = factory.listActive(AdditionalService);
export const getActiveServiceById = factory.getActiveById(AdditionalService);
export const listAllServices = factory.listAll(AdditionalService);
export const createService = factory.createOne(AdditionalService);
export const updateService = factory.updateOne(AdditionalService);
export const setServiceStatus = factory.setActiveStatus(AdditionalService);
export const deleteService = factory.deleteOneUnlessBooked(AdditionalService, "services", "service");
