/**
 * Script to add or remove tags from IBM Cloud
 * Syntax: 
 * 
 * node index.js <operation> [<tagName1:tagValue1> ... <tagNameN:tagValueN>] -- [{Resource1} {ResourceGroup2} ... {ResourceGroupN}] -- <BearerToken>
 * 
 */

 // LCHpIuUjTxl6BrjjITKZtOFm4ODdU9492ma2dB2erann

const GlobalTaggingV1 = require('ibm-platform-services/global-tagging/v1')
const ResourceControllerV2 = require('ibm-platform-services/resource-controller/v2')
const ResourceManagerV2 = require('ibm-platform-services/resource-manager/v2')
const winston = require('./winston')

const { IamAuthenticator } = require('ibm-platform-services/auth')

const groups = process.argv.splice(2).join(' ').split('--')

const resourcesToLookFor = groups[1].trim().split(' ')
const tagsToManage = groups[0].trim().split(' ').splice(1)
const operation = groups[0].trim().split(' ')[0]
const token = groups[2].trim()

const authenticator = new IamAuthenticator({apikey: token})
const tagService = new GlobalTaggingV1({authenticator})
const resourceService = new ResourceControllerV2({authenticator})
const resourceGroupService = new ResourceManagerV2({authenticator})

function shouldIncludeResource(resource, resourcesToLookFor) {
    // all string?
    if(resourcesToLookFor.length > 0 && resourcesToLookFor[0] == "all") {
        return true;
    }

    // exact resource name?
    if(resourcesToLookFor.indexOf(resource.name)!=-1) {
        return true;
    }

    // substring pattern?
    for(const r of resourcesToLookFor) {
        if(r.substring(0, 7) == "substr:") {
            const pattern = r.substring(7)
            if(resource.name.indexOf(pattern)>=0) {
                return true;
            }
        }
    }

    return false;
}

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

async function removeTagsFromResources(tags, resources) {
    await tagService.detachTag({
        tagNames: tags,
        resources: resources
    })
    winston.info('Successfully removed tags from resources.')
}

async function loadResourceGroups() {

    return new Promise(async (resolve) => {
        
        if(resourcesToLookFor.length == 0 || resourcesToLookFor[0] == '') {
            resolve([])
            return
        }

        winston.info('[loadResourceGroups] Capturing resource groups');
        const resourceGroups = await resourceGroupService.listResourceGroups({limit: 500})
        winston.info(`[loadResourceGroups] Resource groups returned: ${resourceGroups.result.resources.length}`)
        const resourceGroupsToConsider = resourceGroups.result.resources.filter(rg => {
           return shouldIncludeResource(rg, resourcesToLookFor)
        })
        winston.info(`[loadResourceGroups] Resource groups after filter: ${resourceGroupsToConsider.length}`)
        resolve(resourceGroupsToConsider)
    })
}

async function loadResources(resourceGroupsToConsider) {

    return new Promise(async (resolve) => {

        if(resourcesToLookFor.length == 0 || resourcesToLookFor[0] == '') {
            resolve([])
            return
        }

        winston.info('[loadResources] Capturing resource instances');
        const resources = await resourceService.listResourceInstances({limit: 500})
        winston.info(`[loadResources] Resources returned: ${resources.result.resources.length}`)
        const resourcesToManage = resources.result.resources.filter(resource => {
             
            if(shouldIncludeResource(resource, resourcesToLookFor)) {
                return true;
            }
    
             const rgid = resource.resource_group_id
             for(const rg of resourceGroupsToConsider) {
                 if(rg.id == rgid) {
                     return true;
                 }
             }

    
             return false;
        })
        winston.info(`[loadResources] Resources after filter: ${resourcesToManage.length}`)
        resolve(resourcesToManage.map(r => { return {resource_id : r.id} }))
    })
}

async function loadAccountTags() {
    return new Promise(async (resolve) => {
        if(tagsToManage.length == 0 || tagsToManage[0] == '') {
            resolve([])
            return
        }

        winston.info('[loadAccountTags] Capturing account tags');
        const accountTags = await tagService.listTags({limit: 500});
        winston.info(`[loadAccountTags] Account tags returned: ${accountTags.result.items.length}`)
        const tagsToAddToPlatform = []
    
        for(const tag of tagsToManage) {
            const tagName = tag.split(':')[0]
            let found = false
            for(const accountTag of accountTags.result.items) {
                if(tagName == accountTag.name) {
                    found = true;
                    break;
                }
            }
    
            if(!found) {
                tagsToAddToPlatform.push(tag)
            }
        }

        winston.info(`[loadAccountTags] Tags to add to platform: ${tagsToAddToPlatform.length}`)
        resolve(tagsToAddToPlatform)
    
    })
}

async function cleanUnusedTags() {
    const response = await tagService.deleteTagAll()
    winston.info(`[cleanUnusedTags] Removed ${response.result.total_count} unused tag(s).`)
}

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

async function removeTagsFilteringByName(prefixes, resourcesToManage) {
    for(const resource of resourcesToManage) {
        winston.debug(`[removeTagsFilteringByName] Recovering tags for resource ${resource.resource_id}`)
        const tags = await tagService.listTags(
            {attachedTo: resource.resource_id }
        )

        winston.debug(`[removeTagsFilteringByName] Tags returned for resource ${resource.resource_id} : ${tags.result.items.length}`)
        for(const tag of tags.result.items) {
            const name = tag.name.split(':')[0]
           
            if(prefixes.indexOf(name) !=-1) {
                winston.info(`[removeTagsFilteringByName] Removing tag ${tag.name} from resource ${resource.resource_id}`)
                await tagService.detachTag({
                    tagName: tag.name,
                    resources: [resource]
                })
            }
        }
    }

    
}

async function main() {
    winston.debug('STARTING!');
 
    const resourceGroupsToConsider = await loadResourceGroups()
    const [resourcesToManage, tagsToAddToPlatform] = await Promise.all([
        loadResources(resourceGroupsToConsider),
        loadAccountTags()
    ])

    if(operation == "attach-tag") {
       await addTagsToResources(tagsToManage, resourcesToManage)
    }

    if(operation == "detach-tag") {
       await removeTagsFromResources(tagsToManage, resourcesToManage)
    }

   
    if(operation == "detach-tag-by-name") {
        await removeTagsFilteringByName(tagsToManage, resourcesToManage)
    }

    if(operation == "replace-tag") {
        await replaceTag(tagsToManage, resourcesToManage)
    }

    if(operation == "replace-tag-name") {
        // await replaceTagValue(tags, resourcesToManage)
    }

    if(operation == "clean-unused-tags") {
        await cleanUnusedTags()
    }

    winston.info('FINISHED!')

}

main()

