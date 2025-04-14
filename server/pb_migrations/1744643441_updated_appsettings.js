/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2359419521")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "bool3095798923",
    "name": "allowRegistration",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "number2456793645",
    "max": null,
    "min": null,
    "name": "maxCanvasesPerUser",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "number1104191717",
    "max": null,
    "min": null,
    "name": "maxStoragePerUser",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2359419521")

  // remove field
  collection.fields.removeById("bool3095798923")

  // remove field
  collection.fields.removeById("number2456793645")

  // remove field
  collection.fields.removeById("number1104191717")

  return app.save(collection)
})
