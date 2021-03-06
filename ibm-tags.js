/**
 * Script to add or remove tags from IBM Cloud
 * Syntax: 
 * 
 * node index.js <operation> [<tagName1:tagValue1> ... <tagNameN:tagValueN>] -- [{Resource1} {ResourceGroup2} ... {ResourceGroupN}] -- <BearerToken>
 * 
 */

/**
 * Required libraries
 */
const GlobalTaggingV1 = require('ibm-platform-services/global-tagging/v1')
const GlobalSearchV2 = require('ibm-platform-services/global-search/v2')
const winston = require('./winston')

const { IamAuthenticator } = require('ibm-platform-services/auth')

/**
 * Command-line Parameters 
 */
const groups = process.argv.splice(2).join(' ').split('--')

const resourcesToLookFor = groups[1].trim().split(' ')
const tagsToManage = groups[0].trim().split(' ').splice(1)
const operation = groups[0].trim().split(' ')[0]
const token = groups[2].trim()

/**
 * Service instances
 */
const authenticator = new IamAuthenticator({ apikey: token })
const tagService = new GlobalTaggingV1({ authenticator })
const searchService = new GlobalSearchV2({ authenticator })

/**
 * Observe if a resource should be included in the selection list.
 * This observe a set of strings as resource selectors to return to the caller a boolean indicating the resource should be selected.
 * Three basic selectors are available:
 * 
 * 'all' word       -> in this case, the resource must be selected
 * exact name match -> in this case, the resource must be selected
 * substring pattern-> in this case, the resource must be selected.
 * Otherwise, the resource must not be selected.
 * 
 * @param {*} resource             Resource Object
 * @param {*} resourcesToLookFor   Array of strings with resource selectors. Each selector will be checked.
 * 
 * @returns   a boolean with true if resource is selected; false otherwise
 */
function shouldIncludeResource(resource, resourcesToLookFor) {
    // all string?
    if (resourcesToLookFor.length > 0 && resourcesToLookFor[0] == "all") {
        return true;
    }

    // exact resource name?
    if (resourcesToLookFor.indexOf(resource.name) != -1) {
        return true;
    }

    // substring pattern?
    for (const r of resourcesToLookFor) {
        if (r.substring(0, 7) == "substr:") {
            const pattern = r.substring(7)
            if (resource.name.indexOf(pattern) >= 0) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Attach a set of tags to a set of resources, using the IBM Cloud Global Tagging API.
 * 
 * @param {*} tags        an array of tags
 * @param {*} resources   an array of resource objects. This object must have only an attribute named 'resource_id'.
 * 
 */
async function addTagsToResources(tags, resources) {
    winston.debug(`Calling addTagValuesToResources with parameters: 
    TAGS: ${tags}
    RESOURCES: ${JSON.stringify(resources)}`)

    await tagService.attachTag({
        tagNames: tags,
        resources: resources
    })

    winston.info('Successfully added tags to resources.')
}

/**
 * Detach a set of tags from a set of resources, using the IBM Cloud Global Tagging API.
 * 
 * @param {*} tags        an array of tags
 * @param {*} resources   an array of resource objects. This object must have only an attribute named 'resource_id'.
 * 
 */
async function removeTagsFromResources(tags, resources) {
    await tagService.detachTag({
        tagNames: tags,
        resources: resources
    })
    winston.info('Successfully removed tags from resources.')
}


/**
 * Load selected resource instances using IBM Cloud Global Search API.
 * This method will check if a resource should be selected thru shouldIncludeResource() function.
 * In addition, a list of selected resource groups, CF organizations and spaces are fetched and their resource instances are added into the resulting array.
 * 
 * @returns a Promise with an array of objects containing selected resource CRNs.
 */
async function loadResources() {

    return new Promise(async (resolve) => {

        if (resourcesToLookFor.length == 0 || resourcesToLookFor[0] == '') {
            resolve([])
            return
        }

        winston.info('[loadResources] Capturing resource groups and resource instances');
        // const resources = await resourceService.listResourceInstances({limit: 500})
        const resources = await searchService.search({
            limit: 1000,
            query: '*',
            fields: ["name", "tags", "service_name", "type", "doc.resource_group_id", "region", "doc.space_guid", "organization_guid"]
        })


        let numberOfResourceGroups = 0
        const resourceGroupsToConsider = resources.result.items.filter(resource => {
            if (resource.type == "resource-group" || resource.type == "cf-organization" || resource.type == "cf-space") {
                numberOfResourceGroups++;
                if (shouldIncludeResource(resource, resourcesToLookFor)) {
                    winston.debug(`[loadResources] Adding ${resource.type} ${resource.name} to the list of groups to consider.`)
                    resource.id = resource.crn.split(':')[9]
                    return true;
                }
            }

            return false;
        })
        winston.info(`[loadResources] Groups returned: ${numberOfResourceGroups}`)
        winston.info(`[loadResources] Groups after filter: ${resourceGroupsToConsider.length}`)

        winston.info(`[loadResources] Resources returned: ${resources.result.items.length}`)
        const resourcesToManage = resources.result.items.filter(resource => {

            //console.log(resource)
            // do not consider account structural resources
            if (resource.type == "resource-group" || resource.type == "cf-organization" || resource.type == "cf-space") {
                return false;
            }

            if (shouldIncludeResource(resource, resourcesToLookFor)) {
                winston.debug(`[loadResources] Adding resource ${resource.name} to the list. Reason=NameMatch`)
                return true;
            }

            // organization guid
            if (resource.organization_guid) {
                const rgid = resource.organization_guid
                for (const rg of resourceGroupsToConsider) {
                    if (rg.id == rgid) {
                        
                        winston.debug(`[loadResources] Adding resource ${resource.name} to the list. Reason=OrganizationMatch`)
                        return true;
                    }
                }
            }
            if (resource.doc) {
                // resource group
                if (resource.doc.resource_group_id) {
                    const rgid = resource.doc.resource_group_id
                    for (const rg of resourceGroupsToConsider) {
                        if (rg.id == rgid) {
                           
                            winston.debug(`[loadResources] Adding resource ${resource.name} to the list. Reason=ResourceGroupMatch`)
                            return true;
                        }
                    }
                }

                // space guid
                if (resource.doc.space_guid) {
                    const rgid = resource.doc.space_guid
                    for (const rg of resourceGroupsToConsider) {
                        if (rg.id == rgid) {
                           
                            winston.debug(`[loadResources] Adding resource ${resource.name} to the list. Reason=SpaceMatch`)
                            return true;
                        }
                    }
                }
            }


            return false;
        })
        winston.info(`[loadResources] Resources after filter: ${resourcesToManage.length}`)
        resolve(resourcesToManage.map(r => { return { resource_id: r.crn, tags: r.tags, name: r.name, resource_type: r.type } }))
    })
}

/**
 * Clean tags that are not attached to any resource, thru deleteTagAll API call.
 * This method does not receive any parameter and does not produce any return.
 */
async function cleanUnusedTags() {
    const response = await tagService.deleteTagAll()
    winston.info(`[cleanUnusedTags] Removed ${response.result.total_count} unused tag(s).`)
}

/**
 * Replace a complete tag (label only or name:value pair) by a different one.
 * It accomplishes this by detaching the old tag and attaching the new one.
 * 
 * @param {*} tags        an array containing the old tag and new tag 
 * @param {*} resources   an array of resource objects containing an attribute named resource_id
 */
async function replaceTag(tags, resources) {
    const tag1 = tags[0]
    const tag2 = tags[1]

    await tagService.detachTag({
        tagNames: [tag1],
        resources: resources
    })

    await tagService.attachTag({
        tagNames: [tag2],
        resources: resources
    })

    winston.info('[replaceTag] Tag successfully replaced.')
}

/**
 * Detach tags from resources that match the tag name.
 * This method will ignore the value part of a name:value pair while evaluating the resource tags.
 * 
 * @param {*} prefixes            an array of tag names
 * @param {*} resourcesToManage   an array of resource objects containing an attribute named resource_id
 */
async function removeTagsFilteringByName(prefixes, resourcesToManage) {
    for (const resource of resourcesToManage) {
        winston.debug(`[removeTagsFilteringByName] Recovering tags for resource ${resource.resource_id}`)

        const tags = await tagService.listTags(
            { attachedTo: resource.resource_id }
        )

        winston.debug(`[removeTagsFilteringByName] Tags returned for resource ${resource.resource_id} : ${tags.result.items.length}`)
        for (const tag of tags.result.items) {
            const name = tag.name.split(':')[0]

            if (prefixes.indexOf(name) != -1) {
                winston.info(`[removeTagsFilteringByName] Removing tag ${tag.name} from resource ${resource.resource_id}`)
                await tagService.detachTag({
                    tagName: tag.name,
                    resources: [resource]
                })
            }
        }
    }


}

/**
 * Replace a tag name by a new one.
 * This method will ignore the value part of a name:value pair while evaluating the resource tags.
 * 
 * @param {*} prefixes            an array containing the old name and the new name
 * @param {*} resourcesToManage   an array of resource objects containing an attribute named resource_id
 */
async function replaceTagName(prefixes, resourcesToManage) {
    const tagName1 = prefixes[0]
    const tagName2 = prefixes[1]

    for (const resource of resourcesToManage) {
        winston.debug(`[removeTagsFilteringByName] Recovering tags for resource ${resource.resource_id}`)

        const tags = await tagService.listTags(
            { attachedTo: resource.resource_id }
        )

        winston.debug(`[removeTagsFilteringByName] Tags returned for resource ${resource.resource_id} : ${tags.result.items.length}`)
        for (const tag of tags.result.items) {
            const nameValuePair = tag.name.split(':')
            const name = nameValuePair[0]
            const value = nameValuePair.length >= 1 ? `:${nameValuePair[1]}` : ''

            if (tagName1 == name) {
                winston.info(`[removeTagsFilteringByName] Replacing tag name ${name} in resource ${resource.resource_id} with ${tagName2}`)
                await tagService.detachTag({
                    tagName: tag.name,
                    resources: [resource]
                })

                await tagService.attachTag({
                    tagName: `${tagName2}${value}`,
                    resources: [resource]
                })
            }
        }
    }


}

async function reportTags(tags, resources, type) {

    let counter = 0
    console.log(`
ResourceName, Tag Value
=======================================`)
    for (const resource of resources) {
        let found = false
        for (const tag of resource.tags) {
            const pair = tag.split(':')
            const tagName = pair[0]

            if (tags.indexOf(tagName) >= 0) {
                found = true
                if (type == 'present') {
                    counter++
                    console.log(`${resource.name}, ${tag}`)
                    break;
                }
            }
        }

        if (!found && type == 'absent') {
            counter++
            console.log(`${resource.name}, ${tags}`)
        }
    }

    console.log(
`=======================================
 TOTAL  : ${counter}`)
}

/**
 * Main program logic.
 * 
 * It will:
 * 
 * -> load resources according to resource selectors declared in the command line
 * -> perform one of the available operations
 * -> gracefully finish
 */
async function main() {
    winston.debug('STARTING!');

    const [resources] = await Promise.all([
        loadResources(),
    ])

    const resourcesToManage = resources.map(r => { return { resource_id: r.resource_id } })

    if (operation == "attach-tag") {
        await addTagsToResources(tagsToManage, resourcesToManage)
    }

    if (operation == "detach-tag") {
        await removeTagsFromResources(tagsToManage, resourcesToManage)
    }

    if (operation == "detach-tag-by-name") {
        await removeTagsFilteringByName(tagsToManage, resourcesToManage)
    }

    if (operation == "replace-tag") {
        await replaceTag(tagsToManage, resourcesToManage)
    }

    if (operation == "replace-tag-name") {
        await replaceTagName(tagsToManage, resourcesToManage)
    }

    if (operation == "clean-unused-tags") {
        await cleanUnusedTags()
    }

    if (operation == "report-absent-tags") {
        await reportTags(tagsToManage, resources, 'absent')
    }

    if (operation == "report-present-tags") {
        await reportTags(tagsToManage, resources, 'present')
    }

    winston.info('FINISHED!')

}

main()

